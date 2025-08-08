# WebScraping & File Processing API Guide

Deze guide legt uit hoe je de nieuwe webscraping en file processing API endpoints kunt gebruiken voor chatbot data bronnen.

## 📋 Overzicht

De API biedt nu volledige ondersteuning voor:
- **Website crawling** - Automatisch scrapen van volledige websites
- **File processing** - Upload en verwerking van PDF, CSV, TXT, DOC/DOCX bestanden
- **Real-time updates** - WebSocket verbindingen voor progress tracking

## 🌐 WebScraping Endpoints

### 1. Start Website Crawl

**POST** `/api/v1/chatbots/{chatbotId}/scraping/crawl`

Start een volledige crawl van een website.

```json
{
  "startUrl": "https://example.com",
  "maxDepth": 3,
  "maxPages": 100,
  "includePaths": ["/blog", "/docs"],
  "excludePaths": ["/admin", "/login"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "crawlId": "crawl_12345",
    "status": "started",
    "message": "Website crawl gestart"
  }
}
```

### 2. Get Crawl Status

**GET** `/api/v1/chatbots/{chatbotId}/scraping/crawl/{crawlId}/status`

Haal de huidige status van een crawl op.

**Response:**
```json
{
  "success": true,
  "data": {
    "crawlId": "crawl_12345",
    "status": "running",
    "progress": {
      "totalPages": 50,
      "completedPages": 25,
      "failedPages": 2,
      "percentage": 50
    },
    "startedAt": "2024-01-15T10:00:00Z",
    "message": "Crawling in progress"
  }
}
```

### 3. Cancel Crawl

**DELETE** `/api/v1/chatbots/{chatbotId}/scraping/crawl/{crawlId}`

Stop een lopende crawl.

### 4. Scrape Single Page

**POST** `/api/v1/chatbots/{chatbotId}/scraping/page`

Scrape een enkele webpagina.

```json
{
  "url": "https://example.com/specific-page"
}
```

### 5. Get Scraped Content

**GET** `/api/v1/chatbots/{chatbotId}/scraping/content?page=1&limit=20&search=keyword`

Haal alle gescrapte content op voor een chatbot.

## 📁 File Processing Endpoints

### 1. Upload and Process File

**POST** `/api/v1/chatbots/{chatbotId}/files/upload`

Upload en verwerk een bestand. Gebruik multipart/form-data.

**Form Data:**
- `file`: Het bestand (PDF, CSV, TXT, DOC, DOCX)
- `chunkSize`: Grootte van text chunks (optioneel, default: 500)
- `extractMetadata`: Extract metadata (optioneel, default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "fileId": "file_67890",
    "filename": "document.pdf",
    "fileType": "PDF",
    "fileSize": 1024000,
    "status": "processed",
    "chunksCreated": 25,
    "metadata": {
      "pages": 10,
      "author": "John Doe"
    },
    "processedAt": "2024-01-15T10:15:00Z",
    "message": "Bestand succesvol geüpload en verwerkt"
  }
}
```

### 2. Get Processed Files

**GET** `/api/v1/chatbots/{chatbotId}/files?page=1&limit=20&fileType=PDF&search=filename`

Haal alle verwerkte bestanden op.

### 3. Get File Details

**GET** `/api/v1/chatbots/{chatbotId}/files/{fileId}`

Haal details van een specifiek bestand op, inclusief alle chunks.

### 4. Delete File

**DELETE** `/api/v1/chatbots/{chatbotId}/files/{fileId}`

Verwijder een verwerkt bestand en alle gerelateerde data.

### 5. Reprocess File

**POST** `/api/v1/chatbots/{chatbotId}/files/{fileId}/reprocess`

Verwerk een bestand opnieuw met nieuwe instellingen.

```json
{
  "chunkSize": 750,
  "extractMetadata": true
}
```

## 🔌 WebSocket Real-time Updates

Connect via WebSocket voor real-time progress updates:

```javascript
const ws = new WebSocket('ws://localhost:8080?userId=user123&chatBotId=bot456');

ws.onopen = function() {
  // Subscribe to crawl progress
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: {
      eventType: 'crawl_progress',
      resourceId: 'crawl_12345'
    }
  }));
  
  // Subscribe to file progress
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: {
      eventType: 'file_progress',
      resourceId: 'file_67890'
    }
  }));
};

ws.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'crawl_progress':
      console.log('Crawl progress:', message.data);
      break;
    case 'crawl_completed':
      console.log('Crawl completed:', message.data);
      break;
    case 'file_progress':
      console.log('File progress:', message.data);
      break;
    case 'file_completed':
      console.log('File completed:', message.data);
      break;
  }
};
```

## 🔐 Authentication

Alle endpoints vereisen authenticatie via de `authenticate` middleware. Zorg ervoor dat je een geldig JWT token meestuurt:

```
Authorization: Bearer <your-jwt-token>
```

## 📊 Response Format

Alle responses volgen het standaard format:

```json
{
  "success": boolean,
  "data": any,           // Bij success
  "error": {             // Bij failure
    "message": string,
    "code": string,
    "statusCode": number
  },
  "message": string      // Optionele boodschap
}
```

## 🚀 Gebruik Voorbeelden

### Frontend Integration (React)

```javascript
// Start website crawl
const startCrawl = async () => {
  const response = await fetch(`/api/v1/chatbots/${chatbotId}/scraping/crawl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      startUrl: 'https://example.com',
      maxDepth: 3,
      maxPages: 50
    })
  });
  
  const result = await response.json();
  if (result.success) {
    // Subscribe to progress updates via WebSocket
    subscribeToProgress('crawl_progress', result.data.crawlId);
  }
};

// Upload file
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('chunkSize', '500');
  formData.append('extractMetadata', 'true');
  
  const response = await fetch(`/api/v1/chatbots/${chatbotId}/files/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return await response.json();
};
```

## ⚠️ Limieten & Best Practices

1. **Rate Limiting**: Max 10 crawl requests per minuut per gebruiker
2. **File Size**: Max bestandsgrootte van 10MB
3. **Crawl Limits**: 
   - Free plan: 10 pagina's per crawl
   - Basic plan: 100 pagina's per crawl  
   - Professional plan: 1000 pagina's per crawl
4. **File Types**: Ondersteunde formaten: PDF, CSV, TXT, DOC, DOCX
5. **WebSocket**: Verbindingen worden automatisch gesloten na 30 minuten inactiviteit

## 🐛 Error Codes

- `INVALID_URL`: Ongeldige URL opgegeven
- `CHATBOT_NOT_FOUND`: ChatBot niet gevonden
- `INSUFFICIENT_PERMISSIONS`: Onvoldoende rechten
- `QUOTA_EXCEEDED`: Quota overschreden
- `FILE_TOO_LARGE`: Bestand te groot
- `UNSUPPORTED_FILE_TYPE`: Niet-ondersteund bestandstype
- `CRAWL_NOT_FOUND`: Crawl niet gevonden
- `WEBSOCKET_ERROR`: WebSocket verbindingsfout

## 📞 Support

Voor vragen over de API kun je contact opnemen via:
- Email: support@sync.com
- Documentation: https://docs.sync.com/api
- GitHub Issues: https://github.com/sync/api/issues
