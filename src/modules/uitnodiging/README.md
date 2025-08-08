# Uitnodiging Module

Deze module behandelt het uitnodigingssysteem voor organisaties, waarmee gebruikers kunnen worden uitgenodigd om lid te worden van organisaties.

## Functies

### Uitnodiging Beheer
- **Versturen** van uitnodigingen naar e-mailadressen
- **Beantwoorden** van uitnodigingen (accepteren/afwijzen)
- **Intrekken** van openstaande uitnodigingen
- **Publieke informatie** voor acceptance pagina's

### Overzichten
- **Organisatie uitnodigingen** - alle uitnodigingen van een organisatie
- **Mijn uitnodigingen** - openstaande uitnodigingen voor huidige gebruiker
- **Status filtering** - filter op uitnodiging status

## Statussen

| Status | Beschrijving |
|--------|-------------|
| `PENDING` | Uitnodiging verstuurd, wacht op antwoord |
| `ACCEPTED` | Uitnodiging geaccepteerd, gebruiker is nu lid |
| `DECLINED` | Uitnodiging afgewezen door gebruiker |
| `EXPIRED` | Uitnodiging verlopen (na 7 dagen) |
| `CANCELLED` | Uitnodiging ingetrokken door uitnodiger |

## API Endpoints

### Publieke Endpoints (geen authenticatie)
```
GET    /api/v1/uitnodigingen/:token                   - Haal publieke uitnodiging info op
```

### Geautoriseerde Endpoints
```
POST   /api/v1/uitnodigingen/:token/beantwoord        - Beantwoord uitnodiging
GET    /api/v1/uitnodigingen/:token/quick-accept      - Accepteer direct
DELETE /api/v1/uitnodigingen/:id                     - Intrek uitnodiging
```

### Organisatie Uitnodigingen
```
POST   /api/v1/organisaties/:orgId/uitnodigingen     - Stuur uitnodiging
GET    /api/v1/organisaties/:orgId/uitnodigingen     - Haal organisatie uitnodigingen op
```

### Gebruiker Uitnodigingen  
```
GET    /api/v1/gebruikers/uitnodigingen              - Haal mijn uitnodigingen op
```

## Rechten & Toegang

### Uitnodiging Versturen
- Alleen **eigenaar** en **beheerder** kunnen uitnodigingen versturen
- Alleen **eigenaar** kan andere eigenaren uitnodigen
- Controleert op bestaande uitnodigingen en lidmaatschappen

### Uitnodiging Beantwoorden
- Gebruiker moet ingelogd zijn
- E-mailadres moet overeenkomen met uitnodiging
- Uitnodiging moet geldig en niet verlopen zijn

### Uitnodiging Intrekken
- Alleen **eigenaar** en **beheerder** kunnen uitnodigingen intrekken
- Alleen openstaande (PENDING) uitnodigingen kunnen worden ingetrokken

## Gebruik

### Service Layer
```typescript
import { UitnodigingService } from './modules/uitnodiging';

const uitnodigingService = new UitnodigingService(prisma);

// Verstuur uitnodiging
const result = await uitnodigingService.stuurUitnodiging({
  email: 'user@example.com',
  rol: 'EDITOR',
  organisatieId: 'org-123',
  bericht: 'Welkom bij ons team!'
}, uitnodigerId);

// Beantwoord uitnodiging
await uitnodigingService.beantwoordUitnodiging(
  'token-123', 
  { accepteer: true }, 
  gebruikerId
);
```

### Controller Layer
```typescript
import { UitnodigingController } from './modules/uitnodiging';

const controller = new UitnodigingController(uitnodigingService);
```

## Validatie

Alle input wordt gevalideerd met Zod schemas:
- `maakUitnodigingSchema` - Voor nieuwe uitnodigingen
- `beantwoordUitnodigingSchema` - Voor uitnodiging responses
- `uitnodigingQuerySchema` - Voor query parameters

## Beveiliging

### Token Beveiliging
- Veilige tokens met cryptografische randomness
- Tokens verlopen na 7 dagen
- Tokens zijn éénmalig bruikbaar

### Toegangscontrole
- Rol-gebaseerde rechten voor versturen uitnodigingen
- E-mail verificatie voor beantwoorden
- Organisatie lidmaatschap verificatie voor beheer acties

### Anti-Spam Maatregelen
- Voorkomt duplicate uitnodigingen naar hetzelfde e-mailadres
- Controleert op bestaande organisatie lidmaatschappen
- Rate limiting kan worden toegevoegd in de toekomst

## Database Schema

```sql
-- Uitnodiging tabel
Uitnodiging {
  id: String (UUID, Primary Key)
  email: String (Index)
  rol: OrganisatieRol
  status: UitnodigingStatus (Default: PENDING)
  token: String (Unique, Index)
  bericht: String? (Optional)
  verlooptOp: DateTime
  beantwoordOp: DateTime?
  organisatieId: String (Foreign Key)
  uitnodigerId: String (Foreign Key)
  aangemaaktOp: DateTime
  bijgewerktOp: DateTime
}
```

## Error Handling

Veel voorkomende errors:
- `CONFLICT` - Duplicate uitnodiging of bestaand lidmaatschap
- `FORBIDDEN` - Onvoldoende rechten
- `NOT_FOUND` - Ongeldige of verlopen token
- `VALIDATION_ERROR` - Ongeldige input data

## Toekomstige Uitbreidingen

- **E-mail templates** - Mooie e-mail uitnodigingen
- **Bulk uitnodigingen** - Meerdere uitnodigingen tegelijk
- **Uitnodiging herinneringen** - Automatische follow-up e-mails
- **Uitnodiging statistieken** - Analytics over acceptance rates
