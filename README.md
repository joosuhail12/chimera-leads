## Email Infrastructure

Transactional email now flows through Amazon SES with event tracking pushed to Amazon SNS and ingested by `/api/webhooks/ses`. Key pieces:

1. **Database** – run the Supabase migrations in `supabase/migrations/0003_add_email_events.sql` and `0004_add_email_category.sql` to create the logging tables plus the `category` column.
2. **AWS resources** – 
   - Transactional sends use SES configuration set `chimera-dashboard`.
   - Marketing sends use SES configuration set `chimera-marketing`.
   Both sets publish SEND/DELIVERY/BOUNCE/etc. events to SNS topic `arn:aws:sns:us-east-1:222727886779:chimera-ses-events`, which is subscribed to the production webhook `https://chimera.getpullse.com/api/webhooks/ses` (subscription auto-confirms).
3. **Credentials** – the IAM user `chimera-email-service` has programmatic access limited to SES/SNS. Its key material is stored in `.env.local` for development and as Vercel Environment Variables for production, preview, and development.
4. **Sending API** – use `sendTransactionalEmail` from `src/lib/services/emails.ts`. It logs a record to `outbound_emails`, sends via SES, and updates the status. Pass `category: "marketing"` to automatically route through the marketing configuration set; otherwise the helper defaults to transactional. SNS events are processed by `recordSesNotification`, which also persists every event row for analytics.

Environment variables that must be present in every deployment:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (defaults to `us-east-1`)
- `AWS_SES_REGION` (defaults to `us-east-1`)
- `AWS_SES_CONFIGURATION_SET` (use `chimera-dashboard`)
- `AWS_SES_MARKETING_CONFIGURATION_SET` (use `chimera-marketing`)
- `EMAIL_FROM_ADDRESS` (e.g. `no-reply@getpullse.com` for the verified domain)

To send a test email locally run `node -e "require('./dist').sendTransactionalEmail(...)"` once the project is built, or instrument the onboarding flows to call the helper.
