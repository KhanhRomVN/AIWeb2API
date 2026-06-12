ta cần tham khảo các file quan trọng trong Elara - Free AI/temp/worker
(base) khanhromvn@UbuntuLTS:~/Documents/Coding/Elara & Zen - Combo Free AI And Agent Code/Elara - Free AI/temp/worker$ tree -I node_modules/
.
├── ABLY_SCHEMA.md
├── DATABASE_SCHEMA.md
├── drop-db.sql
├── init-db.sql
├── package.json
├── package-lock.json
├── REDIS_SCHEMA.md
├── scripts
│   ├── add_score_admin.js
│   └── reset-data.js
├── src
│   ├── app.js
│   ├── controllers
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── blackShopController.js
│   │   ├── chatController.js
│   │   ├── scoreController.js
│   │   ├── shopController.js
│   │   └── userController.js
│   ├── db
│   │   ├── redis.js
│   │   └── tidb.js
│   ├── index.js
│   ├── middlewares
│   │   └── authMiddleware.js
│   ├── models
│   │   ├── blackShopModel.js
│   │   ├── scoreModel.js
│   │   ├── shopModel.js
│   │   └── userModel.js
│   ├── repositories
│   │   ├── blackShopRepository.js
│   │   ├── scoreRepository.js
│   │   └── userRepository.js
│   ├── routes
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── blackShopRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── scoreRoutes.js
│   │   ├── shopRoutes.js
│   │   └── userRoutes.js
│   └── services
│       ├── adminService.js
│       ├── blackShopService.js
│       ├── scoreService.js
│       ├── shopService.js
│       └── userService.js
├── worker.js
└── wrangler.toml

sau đó đọc toàn bộ file trong folder Elara - Free AI/server/src

```
(base) khanhromvn@UbuntuLTS:~/Documents/Coding/Elara & Zen - Combo Free AI And Agent Code/Elara - Free AI/server/src$ tree
.
├── app.ts
├── config
│   ├── proxy.ts
│   └── server.ts
├── controllers
│   ├── account.controller.ts
│   ├── chat.controller.ts
│   ├── messages.controller.ts
│   ├── model.controller.ts
│   ├── models.controller.ts
│   ├── provider.controller.ts
│   ├── stats.controller.ts
│   └── upload.controller.ts
├── env.ts
├── middleware
│   ├── errorHandler.ts
│   ├── logger.ts
│   └── version.middleware.ts
├── provider
│   ├── cerebras-cloud.ts
│   ├── claude.ts
│   ├── codex-cli.ts
│   ├── deepseek.ts
│   ├── gemini-cli.ts
│   ├── gemini.ts
│   ├── groq.ts
│   ├── huggingchat.ts
│   ├── kiro-cli.ts
│   ├── mistral.ts
│   ├── provider-config.ts
│   ├── qwen-cli.ts
│   ├── qwen.ts
│   ├── registry.ts
│   ├── sha3_wasm_bg.7b9ca65ddd.wasm
│   ├── types.ts
│   └── zai.ts
├── routes
│   ├── index.ts
│   └── v1
│       ├── account.routes.ts
│       ├── chat.ts
│       ├── claudecode.ts
│       ├── command.routes.ts
│       ├── config.ts
│       ├── debug.ts
│       ├── git.routes.ts
│       ├── index.ts
│       ├── management.ts
│       ├── messages.ts
│       ├── model-sequences.ts
│       ├── model.ts
│       ├── providers
│       │   └── index.ts
│       ├── provider.ts
│       ├── proxy.routes.ts
│       ├── routes.ts
│       ├── stats.ts
│       └── workspace.routes.ts
├── server.ts
├── services
│   ├── account-refresh.service.ts
│   ├── account-selector.ts
│   ├── chat.service.ts
│   ├── command.service.ts
│   ├── config.service.ts
│   ├── db.ts
│   ├── git.service.ts
│   ├── kiro-account.service.ts
│   ├── login.service.ts
│   ├── models-sync.service.ts
│   ├── provider.service.ts
│   ├── proxy-events.ts
│   ├── proxy.service.ts
│   ├── scanner.service.ts
│   ├── stats.service.ts
│   ├── version.service.ts
│   └── workspace.service.ts
├── start.ts
├── types
│   └── index.ts
└── utils
    ├── apiError.ts
    ├── apiResponse.ts
    ├── cert-manager.ts
    ├── chat-validator.tres
    ├── cookie-jar.ts
    ├── database.ts
    ├── env-info.ts
    ├── http-client.ts
    ├── logger.ts
    ├── port.ts
    └── tokenizer.ts
    ```

    ta sẽ chuyển sang folder Elara - Free AI/worker với chức năng i hệt 
    ta sẽ dùng TiDB làm database storage