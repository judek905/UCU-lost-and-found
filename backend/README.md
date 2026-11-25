# Backend database

## Database configuration

The backend connects to MySQL through `mysql2` and reads its connection
settings from the backend `.env` file:

```text
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your-local-mysql-password
DB_NAME=lost_found
```

Copy `.env.example` to `.env` in the `backend` directory and set values for
your local MySQL installation. Keep `.env` private and do not commit it.

## Schema

The repository schema is in [`../lost_found_schema.sql`](../lost_found_schema.sql).
It creates the `lost_found` database and defines these tables:

- `users`: student and administrator accounts
- `categories` and `locations`: lookup values for item reports
- `items`: lost and found reports, including private identifying details
- `claims`: ownership claims and administrator decisions
- `revoked_tokens`: revoked authentication tokens

The script also inserts sample lookup values and test records. Its sample
account password hashes are placeholders, not usable login credentials.

> **Warning:** The SQL file starts by dropping the `lost_found` database. This
> permanently deletes an existing database with that name. Only run it against
> a disposable development database, or back up your data first.

From the `backend` directory, import the schema with:

```sh
mysql -u root -p < ../lost_found_schema.sql
```

After importing, set `DB_NAME=lost_found` in your local `.env` file.

## Backend compatibility note

The current SQL schema and backend routes are not yet aligned. For example,
the schema defines `users.password_hash`, while the authentication route uses
`users.password`. The schema uses `items.reporter_id`, `category_id`, and
`location_id`, while backend routes refer to `user_id`, `category`, and
`campus_location`. The schema's database name also differs from the value in
`backend/.env.example`.

Importing the schema as-is is therefore not sufficient to run all API
operations. Align the schema and route queries before using the backend with
this database.
