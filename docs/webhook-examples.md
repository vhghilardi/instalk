# Instagram Manager – Webhook Payloads

Este documento contém exemplos de payloads que o Instagram Manager envia para o webhook configurado via `WEBHOOK_URL`.

Todos os eventos seguem a estrutura base abaixo:

```json
{
  "event": "instagram.new_message",
  "instance": {
    "id": "<uuid-da-instancia>",
    "name": "<nome-configurado>",
    "username": "<@usuario-instagram>"
  },
  "thread": {
    "id": "<thread_id>",
    "participants": [
      {
        "id": "<id-do-participante>",
        "username": "<usuario>",
        "fullName": "<nome>",
        "profilePicUrl": "https://..."
      }
    ]
  },
  "message": {
    "id": "<item_id>",
    "type": "<item_type>",
    "text": "<texto-ou-fallback>",
    "timestamp": "2025-11-07T14:48:31.005Z",
    "userId": "<id-de-quem-envio>",
    "media": null
  }
}
```

## Exemplos por Tipo de Mensagem

### 1. Mensagem de texto (`item_type = text`)

```json
{
  "event": "instagram.new_message",
  "instance": {
    "id": "1c5aacf9-8f0f-4d34-b5a2-2f16b9a0c5f5",
    "name": "Conta Comercial",
    "username": "lojavirtual"
  },
  "thread": {
    "id": "340282366841710300949128137420463995901",
    "participants": [
      {
        "id": "1234567890",
        "username": "cliente123",
        "fullName": "Cliente Teste",
        "profilePicUrl": "https://instagram.fxyz1-1.fna.fbcdn.net/v/t51.2885-19/xyz.jpg"
      }
    ]
  },
  "message": {
    "id": "32512882850337281203856857370722304",
    "type": "text",
    "text": "Olá, vocês têm o produto em estoque?",
    "timestamp": "2025-11-07T14:48:31.005Z",
    "userId": "1234567890",
    "media": null
  }
}
```

### 2. Mensagem de imagem (`item_type = media`)

```json
{
  "message": {
    "id": "32512882850337281203856857370722305",
    "type": "media",
    "text": "[image]",
    "timestamp": "2025-11-07T15:02:11.441Z",
    "userId": "1234567890",
    "media": {
      "type": "image",
      "url": "https://instagram.fxyz1-1.cdninstagram.com/v/t51.2885-15/e35/abc.jpg?_nc_ht=...",
      "images": [
        "https://instagram.fxyz1-1.cdninstagram.com/v/t51.2885-15/e35/abc.jpg?_nc_ht=...",
        "https://instagram.fxyz1-1.cdninstagram.com/v/t51.2885-15/e35/abc.jpg?width=640&_nc_ht=..."
      ],
      "videos": [],
      "preview": "https://instagram.fxyz1-1.cdninstagram.com/v/t51.2885-15/sh0.08/e35/p640x640/abc.jpg"
    }
  }
}
```

### 3. Mensagem de vídeo (`item_type = media` com vídeo)

```json
{
  "message": {
    "id": "32512882850337281203856857370722306",
    "type": "media",
    "text": "[video]",
    "timestamp": "2025-11-07T15:07:52.210Z",
    "userId": "3210987654",
    "media": {
      "type": "video",
      "url": "https://instagram.fxyz1-1.cdninstagram.com/v/t50.2886-16/def.mp4?_nc_ht=...",
      "images": [
        "https://instagram.fxyz1-1.cdninstagram.com/v/t51.2885-15/e35/p1080x1080/def.jpg"
      ],
      "videos": [
        "https://instagram.fxyz1-1.cdninstagram.com/v/t50.2886-16/def.mp4?_nc_ht=..."
      ],
      "preview": "https://instagram.fxyz1-1.cdninstagram.com/v/t51.2885-15/sh0.08/e35/p640x640/def.jpg"
    }
  }
}
```

### 4. Mensagem de voz (`item_type = voice_media`)

```json
{
  "message": {
    "id": "32512882850337281203856857370722307",
    "type": "voice_media",
    "text": "[Mensagem de áudio]",
    "timestamp": "2025-11-07T15:10:03.781Z",
    "userId": "1234567890",
    "media": {
      "type": "voice",
      "url": "https://instagram.fxyz1-1.cdninstagram.com/v/t51.2885-15/voice/ghi.m4a?_nc_ht=...",
      "durationMs": 18234,
      "durationSeconds": 18.234,
      "waveform": [0.02, 0.15, 0.33, 0.41, 0.27, 0.05],
      "codec": "aac",
      "samplingRate": 44100,
      "preview": null
    }
  }
}
```

### 5. Mídia efêmera (`item_type = raven_media` / `visual_media`)

```json
{
  "message": {
    "id": "32512882850337281203856857370722308",
    "type": "raven_media",
    "text": "[Mensagem de áudio]",
    "timestamp": "2025-11-07T15:13:47.932Z",
    "userId": "3210987654",
    "media": {
      "type": "video_ephemeral",
      "url": "https://instagram.fxyz1-1.cdninstagram.com/v/t50.2886-16/raven/jkl.mp4?_nc_ht=...",
      "expiresAt": "2025-11-07T15:43:47.000Z",
      "images": [
        "https://instagram.fxyz1-1.cdninstagram.com/v/t51.2885-15/e35/preview/jkl.jpg"
      ],
      "videos": [
        "https://instagram.fxyz1-1.cdninstagram.com/v/t50.2886-16/raven/jkl.mp4?_nc_ht=..."
      ],
      "preview": "https://instagram.fxyz1-1.cdninstagram.com/v/t51.2885-15/cover/jkl.jpg"
    }
  }
}
```

> **Nota:** Para mensagens efêmeras, a URL expira rápido. Realize o download imediatamente ao receber o webhook.

### 6. Link compartilhado (`item_type = link`)

```json
{
  "message": {
    "id": "32512882850337281203856857370722309",
    "type": "link",
    "text": "https://instagr.am/p/XYZ/",
    "timestamp": "2025-11-07T15:18:09.411Z",
    "userId": "1234567890",
    "media": {
      "type": "link",
      "url": "https://instagr.am/p/XYZ/"
    }
  }
}
```

## Boas Práticas

- **Persistência:** salve os payloads recebidos; URLs podem expirar.
- **Download imediato:** faça o download da mídia assim que receber o webhook, principalmente para conteúdos efêmeros.
- **Deduplicação:** utilize `message.id` + `thread.id` como chave única para evitar processar mensagens repetidas.
- **Validação:** nem sempre há mídia; verifique se `media` é nulo antes de acessar campos específicos.


