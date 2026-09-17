ở grok-build. device code hoàn toàn ổn, bắt được device-code ở browser so với AIWeb2API. còn ở kiro thì lại "This device code is invalid. Check the code on your device and try again." dù rõ ràng device-code rõ ràng đúng. nên cần tham khảo các file trong
1/ open-sse/executors/kiro (folder)
2/ src/mitm/targets/kiro.ts
3/ src/mitm/handlers/kiro.ts
4/ open-sse/executors/kiro.ts
5/ src/mitm/detection/kiro.ts
6/ src/lib/oauth/services/kiro.ts
7/ open-sse/services/usage/kiro.ts
8/ src/lib/oauth/providers/kiro.ts
9/ src/lib/providers/validation/kiro.ts
10/ open-sse/services/tokenRefresh/providers/kiro.ts
11/ open-sse/services/kiroModels.ts
12/ open-sse/services/kiroRegion.ts
13/ open-sse/executors/kiroThinking.ts
14/ open-sse/utils/kiroSanitizer.ts
15/ src/lib/oauth/kiroSocialPoll.ts
16/ open-sse/translator/response/kiro-to-openai.ts
17/ src/shared/components/KiroAuthModal.tsx
18/ open-sse/services/kiroExternalIdp.ts
(các file ở trên đều là ở folder AIWeb2API/temp/OmniRoute)

sau đó đọc các file trong folder AIWeb2API/src/provider/kiro cho đúng. tạo thêm kiro.sse-parser.ts. ta sẽ lấy OmniRoute là gốc (root). từ đó. ở AIWeb2API/src/provider/kiro đang thiếu gì thì thêm đó