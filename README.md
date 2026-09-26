# KI-AG Plattform · ag.provoid.de

Die Plattform der PROVOID KI-AG. Stand: **Schritt 1, Login und Grundgerüst**.

- SchülerInnen legen sich mit **AG-Code + Pseudonym + Passwort** einen Zugang an. Keine E-Mail, kein Klarname.
- Nach dem Login landen sie auf ihrer Startseite mit Countdown zum AG-Start und den kommenden Bereichen (Kompass, KI-Radar, Quellen einreichen, Projekt, Skill-Baum).
- Im **Coach-Bereich** (`/coach`) legst du AGs an, siehst die Mitglieder, setzt vergessene Passwörter zurück und kannst die Anmeldung öffnen oder schließen.
- Design im Stil des Pitchdecks: Syne und Arimo (lokal eingebunden, keine Google-Anfragen), Navy und Violett.

Technik: Next.js 15, Postgres, Server Actions. Passwörter werden mit bcrypt gehasht, Sessions liegen in der Datenbank (Cookie nur als zufälliges Token), nach 8 Fehlversuchen in 15 Minuten wird ein Login kurz gesperrt.

---

## Lokal starten

```bash
npm install
cp .env.example .env.local          # DATABASE_URL auf eine lokale Postgres zeigen lassen, DATABASE_SSL=disable
npm run db:migrate
npm run coach:create -- olivia       # gibt ein Passwort aus
npm run dev                          # http://localhost:3000
```

---

## Live gehen: Variante A (empfohlen) · App auf Vercel, Datenbank auf Hetzner

### 1. Datenbank auf dem Hetzner-Server

Per SSH auf den Server (Docker muss installiert sein: `curl -fsSL https://get.docker.com | sh`).

```bash
mkdir -p /opt/kiag-db/certs && cd /opt/kiag-db
# Die Dateien deploy/docker-compose.db.yml und deploy/pg_hba.conf aus diesem Projekt hierher kopieren (z. B. per scp)

# Selbstsigniertes Zertifikat für die verschlüsselte Verbindung
openssl req -new -x509 -days 3650 -nodes -subj "/CN=ag-db" \
  -keyout certs/server.key -out certs/server.crt
chown 70:70 certs/server.key certs/server.crt && chmod 600 certs/server.key

# Starkes Passwort ohne Sonderzeichen erzeugen (passt problemlos in die URL)
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > .env
cat .env                              # Passwort notieren

docker compose -f docker-compose.db.yml up -d
```

Firewall: Port 5432 muss von außen erreichbar sein, weil Vercel keine festen IP-Adressen hat. Von außen sind nur verschlüsselte Verbindungen mit Passwort erlaubt (siehe `pg_hba.conf`). In der Hetzner Cloud Firewall bzw. mit `ufw allow 5432/tcp` freigeben.

### 2. Tabellen anlegen und Coach-Konto erstellen

Vom eigenen Rechner aus, im Projektordner:

```bash
export DATABASE_URL="postgres://kiag:PASSWORT@SERVER-IP:5432/kiag"
export DATABASE_SSL=require
npm run db:migrate
npm run coach:create -- olivia
```

### 3. App auf Vercel

1. Projekt in ein (privates) GitHub-Repository hochladen.
2. In Vercel: **Add New → Project → Repository importieren**. Framework wird automatisch erkannt.
3. Unter **Environment Variables** eintragen:
   - `DATABASE_URL` = `postgres://kiag:PASSWORT@SERVER-IP:5432/kiag`
   - `DATABASE_SSL` = `require`
4. Deploy. Die Region ist über `vercel.json` auf Frankfurt (`fra1`) festgelegt, damit die Server in der EU laufen.

### 4. Subdomain ag.provoid.de

1. In Vercel: **Project → Settings → Domains → `ag.provoid.de` hinzufügen**.
2. Beim Domain-Anbieter von provoid.de einen DNS-Eintrag anlegen, den Vercel anzeigt, in der Regel:
   `ag  CNAME  cname.vercel-dns.com`
3. Nach ein paar Minuten ist die Seite unter https://ag.provoid.de erreichbar (HTTPS macht Vercel automatisch).

---

## Live gehen: Variante B · alles auf Hetzner

Wenn alle Daten ausschließlich auf dem eigenen Server liegen sollen:

```bash
# auf dem Server, im Projektordner
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > deploy/.env
docker compose -f deploy/docker-compose.full.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.full.yml exec app node scripts/migrate.mjs
docker compose -f deploy/docker-compose.full.yml exec app node scripts/create-coach.mjs olivia
```

DNS: `ag  A  <IP des Hetzner-Servers>`. Caddy holt das HTTPS-Zertifikat automatisch.

---

## Erste Session: so kommen die SchülerInnen rein

1. Im Coach-Bereich die AG anlegen (Name, Schule, Datum der ersten Session). Der AG-Code wird erzeugt oder selbst gewählt.
2. Den **Direktlink** aus dem Coach-Bereich als QR-Code an die Wand werfen (`https://ag.provoid.de/registrieren?code=…`), dann ist der Code schon eingetragen.
3. Wenn alle drin sind: **Anmeldung schließen**, damit sich niemand Fremdes registriert.
4. Passwort vergessen? Im Coach-Bereich zurücksetzen. Es erscheint ein vorläufiges Passwort, das beim nächsten Login geändert werden muss.

## Vor dem Start erledigen

- [ ] Datenschutzseite (`app/datenschutz/page.tsx`) rechtlich prüfen und die Angaben in [eckigen Klammern] ergänzen
- [ ] Auftragsverarbeitungsverträge mit Hetzner und Vercel abschließen
- [ ] Einverständniserklärung für Eltern (unter 16 Jahren) vorbereiten
- [ ] Impressum-Link im Footer prüfen (`https://provoid.de/impressum`)

## KI-Radar

- **Ablauf:** Kids reichen Links ein (`/radar/einreichen`), aktive Quellen werden täglich um 5 Uhr (UTC) abgerufen. Alles landet in deiner Warteschlange unter `/coach/radar`. „Freigeben“ holt den Artikeltext, lässt die KI eine jugendgerechte Karte schreiben und stellt sie sofort ins Radar. Danach kannst du jede Karte bearbeiten oder ausblenden.
- **Quellen:** Neue Quellen sind inaktiv. Erst „Testen“, dann „Aktivieren“. Der KI-Filter lässt bei gemischten Nachrichtenseiten nur Artikel über KI durch.
- **Umgebungsvariablen in Vercel:**
  - `ANTHROPIC_API_KEY`: API-Schlüssel von console.anthropic.com. Ohne ihn schreibst du Karten selbst.
  - `ANTHROPIC_WORKSPACE_ID` (nur falls nötig): Wenn der Schlüssel keinem Workspace zugeordnet ist, die Workspace-ID aus der Anthropic Console (beginnt mit `wrkspc_`).
  - `ANTHROPIC_MODEL` (optional): Standard ist `claude-sonnet-5`.
  - `CRON_SECRET`: beliebige lange Zufallszeichenkette. Vercel schickt sie beim täglichen Abruf mit.

## Nächste Schritte

Kompass-Befragung → KI-Radar → Quellen einreichen → Projekte → Skill-Baum. Jede Funktion bekommt eine eigene Seite unter `app/` und eigene Tabellen in `db/schema.sql`.
