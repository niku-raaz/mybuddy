// calendar-sync — reads pending events from Supabase and creates them in Google Calendar.
// One-shot: run it on a schedule (local cron now, GitHub Actions later). Idempotent —
// only rows with status='pending' are synced, then marked 'synced'.
package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

type event struct {
	id          string
	title       string
	description string
	location    string
	startTime   time.Time
	endTime     *time.Time
}

func main() {
	_ = godotenv.Load() // load .env if present (handy for local cron); ignore if absent

	ctx := context.Background()

	dbURL := mustEnv("DATABASE_URL")
	saFile := mustEnv("SERVICE_ACCOUNT_FILE")
	calendarID := getenv("CALENDAR_ID", "primary")

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	cal, err := calendar.NewService(ctx,
		option.WithCredentialsFile(saFile),
		option.WithScopes(calendar.CalendarScope),
	)
	if err != nil {
		log.Fatalf("calendar init: %v", err)
	}

	events, err := fetchPending(ctx, pool)
	if err != nil {
		log.Fatalf("fetch pending: %v", err)
	}
	if len(events) == 0 {
		log.Println("no pending events — nothing to sync")
		return
	}

	synced, failed := 0, 0
	for _, e := range events {
		end := e.startTime.Add(time.Hour)
		if e.endTime != nil {
			end = *e.endTime
		}

		gev := &calendar.Event{
			Summary:     e.title,
			Description: e.description,
			Location:    e.location,
			Start:       &calendar.EventDateTime{DateTime: e.startTime.Format(time.RFC3339)},
			End:         &calendar.EventDateTime{DateTime: end.Format(time.RFC3339)},
		}

		created, err := cal.Events.Insert(calendarID, gev).Do()
		if err != nil {
			log.Printf("FAILED %q: %v", e.title, err)
			_, _ = pool.Exec(ctx, `update calendar_events set status='failed' where id=$1`, e.id)
			failed++
			continue
		}

		if _, err := pool.Exec(ctx,
			`update calendar_events set status='synced', google_event_id=$1, synced_at=now() where id=$2`,
			created.Id, e.id); err != nil {
			// The event is already in Google Calendar; log so we don't double-create next run.
			log.Printf("WARN synced to calendar but DB update failed for %q (id=%s): %v", e.title, e.id, err)
		}
		log.Printf("SYNCED %q -> %s", e.title, created.HtmlLink)
		synced++
	}

	log.Printf("done: %d synced, %d failed, %d total", synced, failed, len(events))
}

func fetchPending(ctx context.Context, pool *pgxpool.Pool) ([]event, error) {
	rows, err := pool.Query(ctx, `
		select id, title, coalesce(description, ''), coalesce(location, ''), start_time, end_time
		from calendar_events
		where status = 'pending'
		order by start_time asc`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []event
	for rows.Next() {
		var e event
		if err := rows.Scan(&e.id, &e.title, &e.description, &e.location, &e.startTime, &e.endTime); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func mustEnv(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("missing required env var: %s", k)
	}
	return v
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
