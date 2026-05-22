POST https://chat.z.ai/api/v1/chats/new

{
  "request": {
    "host": "chat.z.ai",
    "connection": "keep-alive",
    "content-length": "594",
    "sec-ch-ua-platform": "\"Linux\"",
    "authorization": "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg",
    "accept-language": "en-US",
    "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
    "sec-ch-ua-mobile": "?0",
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "accept": "application/json",
    "content-type": "application/json",
    "x-region": "overseas",
    "origin": "https://chat.z.ai",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "accept-encoding": "gzip, deflate, br, zstd",
    "cookie": "_ga=GA1.1.1497463483.1768536216; _c_WBKFRo=z6L5HQ8NqlfI5LfqLFB33Wf3tCrXzhu8H8v3WSxh; cdn_sec_tc=6b9b361517793873295171181e244dc34803b09d51dc12dc41b39d76fb; acw_tc=0a094e7017793873294823794e3e953ecac1d1c5a956748b9f18c43de617d1; _gcl_au=1.1.379539313.1779387361; oauth_id_token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjQxYjJlMTFmZjljYTI2ZTc4YzAyNWE5ZDRhNDI5Y2IwNjAxMzk1NmUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI4MDA0MjQzOTE5MjgtcXNxOTZ2YTN0cHVmcTRhamE4YTRhYmlvYm05MTBha3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI4MDA0MjQzOTE5MjgtcXNxOTZ2YTN0cHVmcTRhamE4YTRhYmlvYm05MTBha3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTE0NTA4NDA0NDk1MzcxMjg5NzgiLCJlbWFpbCI6InRoaWVuYmFvdm4yNDY4QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiQ09WdEJRX3JLXzVGd3VWeHV2N3MtdyIsIm5hbWUiOiJC4bqjbyBUaGnDqm4iLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSnFOYmIxaVJXbGV6UVdCb2drRkxvdXJWTFpqRXh0Ry1lM2tId2JxNVdHWmJFUHpnPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6IkLhuqNvIiwiZmFtaWx5X25hbWUiOiJUaGnDqm4iLCJpYXQiOjE3NzkzODczOTgsImV4cCI6MTc3OTM5MDk5OH0.aJ5a5NUuW35Bwdq6pWmfUDCx2XBSRGuLsW-7g49f5nC0CtfX2gwsX1lgJ7JKr7127jzS6z4PqY1ZAPdVZ7gLRno9qL7qr52JiOvKP3FMhBUqyEcUv1QdqtUDyyTpT5AdkEqIt7ePO5ChdGcWaimqoCmvKCxdivJDwn91WukYK8DO3mzhAefCHKBwLmfQmpb2MM3IKmP-3KP7bx1mGOgbCSBGbLhIYKVGU22wkKa9dwAGvvghyl2AdOlUfSJkUGcRafwD8szQfWAUFhsZlcl3D92itZoEw_cw8JsBuT3_ffOBudfqzxGgeqAzYLGS9N5V93dVPfiMKZ5RNVH4jdRK1w; token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg; ssxmod_itna=1-Qq_x0DnQYCqYqAKitG0YbiOYG7kGO7DwrxGqGHDyh6xQ5DODLxn_qGdqcemUIeQQbKi_2DobGBDhExiWbDDseG74qDymxA3DTObK45KSx0KKKGYP3x5DonT4BAKYOYSkS5oZmtZd0NQXtVbYXZQO3D74Gnf4GSDDNDD2rbeqGXeTETDYYDC4GwteG_GeDWDYEfDGtQDG=D7xbD84qFADbWHpabxi3DbgFDmdrFBZHD04qYZe73DDtDid2i7EWDA4WpL9hzhPGv893jqadY2OMvleGyb5Gu7=OWqEIb26cz=oEvbRm04q_A3DomD4Q0D0nb8DbmGxYDxKiNG0eWui8bNBvPqTjSxqMrkDwoiDxewoWHMzy6f_lQ2o8AzCOhK0qewOeuimDY1RN4RiewNU0YvGe0nqiRK2y=1uT7bbIwN/rWQeK=2=prkSvDD; ssxmod_itna2=1-Qq_x0DnQYCqYqAKitG0YbiOYG7kGO7DwrxGqGHDyh6xQ5DODLxn_qGdqcemUIeQQbKi_2DobGBDhExiW4AoTDjroxmtDj4x4YUS00F1DBTKxj4Xt0r7bHEhzi74H=mP4h0C5CPxm0SdV97imPkdQKHrhI8RG0PO=Gzrr44wgi86gpOZoqonoupitKGUOAQobHxw2Fzk32aqF3qXKAEHaYCRBftArovA1M7SxE_2ZkGkZ8_K3oFYBDkq6pAjxM_Crv1woLQRF3k/K3OSrK0sS3ynhDoxNYvA86vbmHX=cIe3yd4CoueeTF_sb7WRTeiOfozAOTRrFYi4_btr2apSbPeaZ3oOxiEEbU_xREWtiOseHt4OGWtPnscMQpfx1r7B_esudnf32uQZfQDjQFWWqGGnQCPCvVe=Q7QRL=iGh3nT1dI6ha_4dc8wmrtm2QB_fM_oPwQq4xroQDZHsPssa_yhLA4tjZ76EkW4Lg26r=izbGmZUh_UB6=iCjeQhMpQeuT7r53WEHo3wc0QSXr9ig624zt125hxwqD6Pmdax7tGxj2b61u7nxxPt5G=eAul8ungOVptmGm73i6Td2/D7bL2xLiBnPpQlg7enD3LNz8p5eTA6jhRE2ISTv2tU04wggzwa9i7aOqA5_Powvymi4=qOXzj/U3qdZKcxtmy0HNRXT2htyyFU3ZxH1esVySlzi0DIPKis7s5Y/Ed_hXoTHheYdSmx08Rheze9_8BkW7SQ8N_xnhR25U5hBxCzarWl8jI1C58xqBztixPCmFCjG=b0cD2xoBzW7CQ8KiCWDprCWs1IRchr0QSQxveQmSWCGDrOAO4=_oisIDqCpW2NeeqxdSrywo7DpONePOEOfP4D; _ga_Z8QTHYBHP3=GS2.1.s1779387281$o8$g1$t1779387617$j56$l0$h0",
    "content-encoding": "none"
  },
  "response": {
    "server": "ESA",
    "content-type": "application/json",
    "content-length": "916",
    "connection": "keep-alive",
    "date": "Thu, 21 May 2026 18:20:17 GMT",
    "vary": "Origin",
    "via": "ens-cache1.l2sg7[68,0,DP], ens-cache32.l2vn4[96,0,DP], ens-cache14.vn37[97,0,DP], ens-cache14.vn37[97,0]",
    "x-site-cache-status": "DYNAMIC",
    "x-process-time": "0",
    "access-control-allow-origin": "https://chat.z.ai",
    "access-control-allow-credentials": "true",
    "access-control-expose-headers": "X-Chat-Id, X-Trace-ID",
    "x-trace-id": "19e4bc450308f175",
    "timing-allow-origin": "*",
    "eagleid": "6b9b362217793876173621368e"
  }
}

{
  "request": "{\"chat\":{\"id\":\"\",\"title\":\"New Chat\",\"models\":[\"GLM-5.1\"],\"params\":{},\"history\":{\"messages\":{\"00a6e59f-162c-4bee-8de9-abd4e8de1dbd\":{\"id\":\"00a6e59f-162c-4bee-8de9-abd4e8de1dbd\",\"parentId\":null,\"childrenIds\":[],\"role\":\"user\",\"content\":\"tôi tên khánh\",\"timestamp\":1779387617,\"models\":[\"GLM-5.1\"]}},\"currentId\":\"00a6e59f-162c-4bee-8de9-abd4e8de1dbd\"},\"tags\":[],\"flags\":[],\"features\":[{\"server\":\"tool_selector_h\",\"status\":\"hidden\",\"type\":\"tool_selector\"}],\"mcp_servers\":[],\"enable_thinking\":false,\"auto_web_search\":false,\"message_version\":1,\"extra\":{},\"timestamp\":1779387617208,\"type\":\"default\"}}",
  "response": "{\"id\":\"b3da38fd-4cb5-4734-815b-9b186df6fa63\",\"user_id\":\"d8230254-6817-4906-b889-169e4d282739\",\"title\":\"New Chat\",\"chat\":{\"id\":\"b3da38fd-4cb5-4734-815b-9b186df6fa63\",\"models\":[\"GLM-5.1\"],\"params\":{},\"history\":{\"messages\":{\"00a6e59f-162c-4bee-8de9-abd4e8de1dbd\":{\"id\":\"00a6e59f-162c-4bee-8de9-abd4e8de1dbd\",\"parentId\":null,\"childrenIds\":[],\"role\":\"user\",\"timestamp\":1779387617,\"content\":\"tôi tên khánh\",\"models\":[\"GLM-5.1\"]}},\"currentId\":\"00a6e59f-162c-4bee-8de9-abd4e8de1dbd\"},\"tags\":[],\"features\":[{\"type\":\"tool_selector\",\"server\":\"tool_selector_h\",\"status\":\"hidden\"}],\"timestamp\":1779387617208,\"extra\":{}},\"updated_at\":1779387617,\"created_at\":1779387617,\"share_id\":null,\"archived\":false,\"pinned\":false,\"meta\":{\"auto_web_search\":false,\"flags\":null,\"mcp_servers\":[],\"models\":[\"GLM-5.1\"],\"workspace_id\":\"b3da38fd-4cb5-4734-815b-9b186df6fa63\"},\"folder_id\":null,\"message_version\":1,\"type\":\"default\",\"im_context\":null}"
}

POST https://chat.z.ai/api/v2/chat/completions?timestamp=1779387617431&requestId=1e8aa0f9-7d30-469f-8e5e-3ba1525a5b17&user_id=d8230254-6817-4906-b889-169e4d282739&version=0.0.1&platform=web&token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg&user_agent=Mozilla%2F5.0+%28X11%3B+Linux+x86_64%29+AppleWebKit%2F537.36+%28KHTML%2C+like+Gecko%29+Chrome%2F146.0.0.0+Safari%2F537.36&language=en-US&languages=en-US%2Cen&timezone=Asia%2FSaigon&cookie_enabled=true&screen_width=1920&screen_height=1080&screen_resolution=1920x1080&viewport_height=958&viewport_width=1920&viewport_size=1920x958&color_depth=24&pixel_ratio=1&current_url=https%3A%2F%2Fchat.z.ai%2Fc%2Fb3da38fd-4cb5-4734-815b-9b186df6fa63&pathname=%2Fc%2Fb3da38fd-4cb5-4734-815b-9b186df6fa63&search=&hash=&host=chat.z.ai&hostname=chat.z.ai&protocol=https%3A&referrer=https%3A%2F%2Faccounts.google.com.vn%2F&title=Z.ai+-+Free+AI+Chatbot+%26+Agent+powered+by+GLM-5.1+%26+GLM-5&timezone_offset=-420&local_time=2026-05-21T18%3A20%3A17.431Z&utc_time=Thu%2C+21+May+2026+18%3A20%3A17+GMT&is_mobile=false&is_touch=false&max_touch_points=10&browser_name=Chrome&os_name=Linux&signature_timestamp=1779387617431

{
  "request": {
    "host": "chat.z.ai",
    "connection": "keep-alive",
    "content-length": "1212",
    "x-fe-version": "prod-fe-1.1.35",
    "sec-ch-ua-platform": "\"Linux\"",
    "authorization": "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg",
    "accept-language": "en-US",
    "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
    "sec-ch-ua-mobile": "?0",
    "x-signature": "fb5bb3b5f5ebddcf0bd742ef44eeb0676e72ea6134cc6551e87594399ff94fd3",
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "content-type": "application/json",
    "x-region": "overseas",
    "accept": "*/*",
    "origin": "https://chat.z.ai",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "accept-encoding": "gzip, deflate, br, zstd",
    "cookie": "_ga=GA1.1.1497463483.1768536216; _c_WBKFRo=z6L5HQ8NqlfI5LfqLFB33Wf3tCrXzhu8H8v3WSxh; cdn_sec_tc=6b9b361517793873295171181e244dc34803b09d51dc12dc41b39d76fb; acw_tc=0a094e7017793873294823794e3e953ecac1d1c5a956748b9f18c43de617d1; _gcl_au=1.1.379539313.1779387361; oauth_id_token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjQxYjJlMTFmZjljYTI2ZTc4YzAyNWE5ZDRhNDI5Y2IwNjAxMzk1NmUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI4MDA0MjQzOTE5MjgtcXNxOTZ2YTN0cHVmcTRhamE4YTRhYmlvYm05MTBha3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI4MDA0MjQzOTE5MjgtcXNxOTZ2YTN0cHVmcTRhamE4YTRhYmlvYm05MTBha3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTE0NTA4NDA0NDk1MzcxMjg5NzgiLCJlbWFpbCI6InRoaWVuYmFvdm4yNDY4QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiQ09WdEJRX3JLXzVGd3VWeHV2N3MtdyIsIm5hbWUiOiJC4bqjbyBUaGnDqm4iLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSnFOYmIxaVJXbGV6UVdCb2drRkxvdXJWTFpqRXh0Ry1lM2tId2JxNVdHWmJFUHpnPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6IkLhuqNvIiwiZmFtaWx5X25hbWUiOiJUaGnDqm4iLCJpYXQiOjE3NzkzODczOTgsImV4cCI6MTc3OTM5MDk5OH0.aJ5a5NUuW35Bwdq6pWmfUDCx2XBSRGuLsW-7g49f5nC0CtfX2gwsX1lgJ7JKr7127jzS6z4PqY1ZAPdVZ7gLRno9qL7qr52JiOvKP3FMhBUqyEcUv1QdqtUDyyTpT5AdkEqIt7ePO5ChdGcWaimqoCmvKCxdivJDwn91WukYK8DO3mzhAefCHKBwLmfQmpb2MM3IKmP-3KP7bx1mGOgbCSBGbLhIYKVGU22wkKa9dwAGvvghyl2AdOlUfSJkUGcRafwD8szQfWAUFhsZlcl3D92itZoEw_cw8JsBuT3_ffOBudfqzxGgeqAzYLGS9N5V93dVPfiMKZ5RNVH4jdRK1w; token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg; _ga_Z8QTHYBHP3=GS2.1.s1779387281$o8$g1$t1779387618$j55$l0$h0; ssxmod_itna=1-Qq_x0DnQYCqYqAKitG0YbiOYG7kGO7DwrxGqGHDyh6xQ5DODLxn_qGdqcemUIeQQbKi_2DobGBDhExDj2rNDlrD_oQDCTKGfDQpoOYC7A5TKKGQpGW5DonTb7EKYOiSkS5oxptZd0NQXtVbYXZQh3D74Gnj4GSDDNDD2rb74GX7bETDYYDC4GwteG_GeDWDYoLDGtQDG=D7xbD84qFADbWHpabxi3DbgFDmdrFBZHD04qYZe73DDtDid2i7EWDA4WpL9hzhPGv8/3jq1dY2OkAleGyb5Gu7=OWqEIb26cz=ooAbRe2eq4E3DomD4QiTWR47DbmGxYDxKiNG0eYGqK4eWbkeqK=rjSxqMrk4woiDx7_oWHMzy6j_lQ2o8AzGOhK0q7_O7RimGYXBN4Ri7_tiGD=mr0nqib52Ht1qWKDb43qVxqm_hSxVQrtphK=GDD; ssxmod_itna2=1-Qq_x0DnQYCqYqAKitG0YbiOYG7kGO7DwrxGqGHDyh6xQ5DODLxn_qGdqcemUIeQQbKi_2DobGBDhExDj2hoD=O_Eb4iUD7PLK0S0DxIdD054jq0_D_BueC7zG7OinbRQ_BpO89x/jeKCKTmC5=qBK=KB9DfoqoCowhXPHk7rw12E5HPeH1p67CbGcCwoqq_3EQSa5GGbyp=89f0xgkMoKx23oxpxhzwoAkYBi1q6Mmc=3sRWKHHPvEp/810RfQVaEtAFWpQ0P4mey_aSA6dVAezbYepowe/bY4jNrgGaoGH/7ZK39gI2YUI4xb7bB_oh_Wr4Q8_iordW8snYWQDHmRx/__uRNEdttDHSTOLdHmfx1gQaweTudA8dab43_i6rNFTpmSNgwIOmoRnIIhxGbzxlsNRWvjbzSs5RH3wDB8IASiOMT=c3Aholqk34C=Z1yfpIhD_xf84t_aHCMb=cTmcAbSrIltNb611O6Pk7rvHc8/dXWmNNR=SBsa8tBaXnpa2Ps9MUFpdCEw/jh=x6WrdiiFhpxc2xq7jh6htDvyRDcgNCapqLUCheOjb34tu28Wlt50cX/F=P4zUu7d=S3sK0HfgrhCsVpLyjUrkQqageU2d/TVcFUP6aRH0rIIjuKBu7PapxHjU5YGoYODZilUe=Mbd=OnF/zmBGN7GQ=/vO/72r0y3RNWu5UhsM5DfaChVpshRxAKy54bGtmxUsche732mxD5y53hP52/25cKPS=tiP9OzYUD_AhYfPH7ScdVxKzPGPT2DFakDKBII1dQY4ewM_NEqnYPzd_7yZ5Qp58s=r0ghrD=IepAeimFn6GDeEaC44woBDbGo0DIilnqViiQeQhtl=kEx74Ao7mpeiNBD4D",
    "content-encoding": "none"
  },
  "response": {
    "server": "ESA",
    "content-type": "text/event-stream; charset=utf-8",
    "transfer-encoding": "chunked",
    "connection": "keep-alive",
    "date": "Thu, 21 May 2026 18:20:48 GMT",
    "vary": "Accept-Encoding, Accept-Encoding, Origin",
    "via": "ens-cache34.l2sg7[30157,0,DP], ens-cache13.vn37[30177,0,DP], ens-cache13.vn37[30178,0]",
    "x-site-cache-status": "DYNAMIC",
    "x-process-time": "30",
    "access-control-allow-origin": "https://chat.z.ai",
    "access-control-allow-credentials": "true",
    "access-control-expose-headers": "X-Chat-Id, X-Trace-ID",
    "x-trace-id": "19e4bc4554e3c8c1",
    "timing-allow-origin": "*",
    "eagleid": "6b9b362117793876186626961e"
  }
}

{
  "request": "{\"stream\":true,\"model\":\"GLM-5.1\",\"messages\":[{\"role\":\"user\",\"content\":\"tôi tên khánh\"}],\"signature_prompt\":\"tôi tên khánh\",\"params\":{},\"extra\":{},\"features\":{\"image_generation\":false,\"web_search\":false,\"auto_web_search\":false,\"preview_mode\":true,\"flags\":[],\"vlm_tools_enable\":false,\"vlm_web_search_enable\":false,\"vlm_website_mode\":false,\"enable_thinking\":false},\"variables\":{\"{{USER_NAME}}\":\"ThienBao\",\"{{USER_LOCATION}}\":\"Unknown\",\"{{CURRENT_DATETIME}}\":\"2026-05-22 01:20:18\",\"{{CURRENT_DATE}}\":\"2026-05-22\",\"{{CURRENT_TIME}}\":\"01:20:18\",\"{{CURRENT_WEEKDAY}}\":\"Friday\",\"{{CURRENT_TIMEZONE}}\":\"Asia/Saigon\",\"{{USER_LANGUAGE}}\":\"en-US\"},\"chat_id\":\"b3da38fd-4cb5-4734-815b-9b186df6fa63\",\"id\":\"e9bd63fc-a818-41bd-bbf4-6f48fa2b87e1\",\"current_user_message_id\":\"00a6e59f-162c-4bee-8de9-abd4e8de1dbd\",\"current_user_message_parent_id\":null,\"background_tasks\":{\"title_generation\":true,\"tags_generation\":true},\"captcha_verify_param\":\"eyJjZXJ0aWZ5SWQiOiJXd3hnbFQ0RGVJIiwic2NlbmVJZCI6ImRpZGszM2UwIiwiaXNTaWduIjp0cnVlLCJzZWN1cml0eVRva2VuIjoiNm9PbzdlNzJuQTYxdVZMaVpWS2lMWXFGMW05ck9ubzN2RUlQSkthTDdLTHhDSnFiMVVCd1JwbDRwN0VjRlRnZGVwWVkzTVZ5TGVaVDRUUHpDVTB6MnRqUGNxYWZscWJRTFpRZFgycllkLzhiaG5xaElwQzdTblJsSXhHUHNxdlgifQ==\"}",
  "response": "data: {\"timestamp\":1779387648,\"type\":\"heartbeat\"}\n\n"
}

POST https://chat.z.ai/api/v1/chats/new

{
  "request": {
    "host": "chat.z.ai",
    "connection": "keep-alive",
    "content-length": "594",
    "sec-ch-ua-platform": "\"Linux\"",
    "authorization": "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg",
    "accept-language": "en-US",
    "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
    "sec-ch-ua-mobile": "?0",
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "accept": "application/json",
    "content-type": "application/json",
    "x-region": "overseas",
    "origin": "https://chat.z.ai",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "accept-encoding": "gzip, deflate, br, zstd",
    "cookie": "_ga=GA1.1.1497463483.1768536216; _c_WBKFRo=z6L5HQ8NqlfI5LfqLFB33Wf3tCrXzhu8H8v3WSxh; cdn_sec_tc=6b9b361517793873295171181e244dc34803b09d51dc12dc41b39d76fb; acw_tc=0a094e7017793873294823794e3e953ecac1d1c5a956748b9f18c43de617d1; _gcl_au=1.1.379539313.1779387361; oauth_id_token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjQxYjJlMTFmZjljYTI2ZTc4YzAyNWE5ZDRhNDI5Y2IwNjAxMzk1NmUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI4MDA0MjQzOTE5MjgtcXNxOTZ2YTN0cHVmcTRhamE4YTRhYmlvYm05MTBha3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI4MDA0MjQzOTE5MjgtcXNxOTZ2YTN0cHVmcTRhamE4YTRhYmlvYm05MTBha3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTE0NTA4NDA0NDk1MzcxMjg5NzgiLCJlbWFpbCI6InRoaWVuYmFvdm4yNDY4QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiQ09WdEJRX3JLXzVGd3VWeHV2N3MtdyIsIm5hbWUiOiJC4bqjbyBUaGnDqm4iLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSnFOYmIxaVJXbGV6UVdCb2drRkxvdXJWTFpqRXh0Ry1lM2tId2JxNVdHWmJFUHpnPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6IkLhuqNvIiwiZmFtaWx5X25hbWUiOiJUaGnDqm4iLCJpYXQiOjE3NzkzODczOTgsImV4cCI6MTc3OTM5MDk5OH0.aJ5a5NUuW35Bwdq6pWmfUDCx2XBSRGuLsW-7g49f5nC0CtfX2gwsX1lgJ7JKr7127jzS6z4PqY1ZAPdVZ7gLRno9qL7qr52JiOvKP3FMhBUqyEcUv1QdqtUDyyTpT5AdkEqIt7ePO5ChdGcWaimqoCmvKCxdivJDwn91WukYK8DO3mzhAefCHKBwLmfQmpb2MM3IKmP-3KP7bx1mGOgbCSBGbLhIYKVGU22wkKa9dwAGvvghyl2AdOlUfSJkUGcRafwD8szQfWAUFhsZlcl3D92itZoEw_cw8JsBuT3_ffOBudfqzxGgeqAzYLGS9N5V93dVPfiMKZ5RNVH4jdRK1w; token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg; ssxmod_itna=1-Qq_x0DnQYCqYqAKitG0YbiOYG7kGO7DwrxGqGHDyh6xQ5DODLxn_qGdqcemUIeQQbKi_2DobGBDhEKQSxGN4iQhxGkRDWPGEQoqhqqZD7qqqi_bDfqGeSogdWqmQDcZlwmCts/py5mTXXe0TNTm4DIDY=fDAtD0qDi8mm0DBL0WSeD44DvDBYqxAA5xDPDb_3DAqqD7qDFzeGI0GP3zlWaH1WDm4GWjPDgimp1ZPDj0B2tVp4DGqDniQeFYPDf/QOf1GyHxBoILS8iuSrCn9EtxB=nxBjar/nifhnkOpHTbREmQxQ0GDf4YheiGxK0pQ247DbmGxYDxKiNG0eYGqK4eW4kDqK=xjSxqMxk/RbYi7QrS7vMjPa_votrquudonDzi73T7K_e3nqZxie4q4q=h0DCihQRpzDbSBZ0OkCRDi44mutODW3WN9vo0EQnAxeD; ssxmod_itna2=1-Qq_x0DnQYCqYqAKitG0YbiOYG7kGO7DwrxGqGHDyh6xQ5DODLxn_qGdqcemUIeQQbKi_2DobGBDhEKQQxAoTDjroxPiDj42AHwBYYxDlrBSDRqDwBfxuGdXt3q075T4x75k1jU0Zl75Dh7tCPxk=GqRrBGD4KqeI9DvaKxp6iketFmoFPO9=Hph=IemPB7emgOqtfIwZyOLZv1wOA1X298i_B8OFdhe8EQUrK_RBAQKzIQEoqo14IQwPjurNdoN51Oi0vQw4Zf2EQFPwP4rZCW=q6x=LoyETibtq=4Lx=zjOVFCX7Ra=72nS8pM3RD4jLsKisqYG5MsW4stAQPWz5GGASO_wHGO=MoOq4HbBObmsvwGaRt5wGme8rqbZd82S8Kur6d4enaNTNenpgWClmKVqbAn5IWz2k_6MieeOgQ8LW5fh_KLbZqdMxpt7Q1Wm1TwzMIRThBkfqMOETANu7d4pvPs8azwl3i0D_jA6w8e_eX3fyc_KappP8/cbbCQYAiGo1mlzH=2=wTj4xd8LSAOrO6_hzHheWzDLr4mlDFtGrOQyTTT_=XpbMZ=GLQjTF/33IqzfCaRb_qGIvg1xCOlCHkKpEhDVh7p2IDuWH65pqoqA5Ifx7henhUaj3QASHHQTsMkIgvoMWNlR=tvSrGySN8lMbkf_A544b9Me4/Hr4ea4FdM3pew_qBDQD9O3VyAioc9U7Di0FADq4li4Z5ucGH2qbYKin13=YLoKi0EB1Qi6pacINnspRhg1=G7i4cIeGzqY9aD0w7ebo74hY0Tq3YcyEYx75zmOPAxoPK0bBDZGrf=Z0Neeqx62G5_o7mKED84t0oWY4D; _ga_Z8QTHYBHP3=GS2.1.s1779387281$o8$g1$t1779387660$j13$l0$h0",
    "content-encoding": "none"
  },
  "response": {
    "server": "ESA",
    "content-type": "application/json",
    "content-length": "916",
    "connection": "keep-alive",
    "date": "Thu, 21 May 2026 18:21:07 GMT",
    "vary": "Origin",
    "via": "ens-cache9.l2sg7[7140,0,DP], ens-cache25.l2vn4[7165,0,DP], ens-cache11.vn37[7165,0,DP], ens-cache11.vn37[7165,0]",
    "x-site-cache-status": "DYNAMIC",
    "x-process-time": "7",
    "access-control-allow-origin": "https://chat.z.ai",
    "access-control-allow-credentials": "true",
    "access-control-expose-headers": "X-Chat-Id, X-Trace-ID",
    "x-trace-id": "19e4bc4f9438c5b5",
    "timing-allow-origin": "*",
    "eagleid": "6b9b361f17793876606491985e"
  }
}

{
  "request": "{\"chat\":{\"id\":\"\",\"title\":\"New Chat\",\"models\":[\"GLM-5.1\"],\"params\":{},\"history\":{\"messages\":{\"45742a9e-5231-47d7-a3b9-2a78059b5add\":{\"id\":\"45742a9e-5231-47d7-a3b9-2a78059b5add\",\"parentId\":null,\"childrenIds\":[],\"role\":\"user\",\"content\":\"tôi tên khánh\",\"timestamp\":1779387660,\"models\":[\"GLM-5.1\"]}},\"currentId\":\"45742a9e-5231-47d7-a3b9-2a78059b5add\"},\"tags\":[],\"flags\":[],\"features\":[{\"server\":\"tool_selector_h\",\"status\":\"hidden\",\"type\":\"tool_selector\"}],\"mcp_servers\":[],\"enable_thinking\":false,\"auto_web_search\":false,\"message_version\":1,\"extra\":{},\"timestamp\":1779387660547,\"type\":\"default\"}}",
  "response": "{\"id\":\"3b1eb71e-d0ab-44b1-a49d-7cb1b4d01890\",\"user_id\":\"d8230254-6817-4906-b889-169e4d282739\",\"title\":\"New Chat\",\"chat\":{\"id\":\"3b1eb71e-d0ab-44b1-a49d-7cb1b4d01890\",\"models\":[\"GLM-5.1\"],\"params\":{},\"history\":{\"messages\":{\"45742a9e-5231-47d7-a3b9-2a78059b5add\":{\"id\":\"45742a9e-5231-47d7-a3b9-2a78059b5add\",\"parentId\":null,\"childrenIds\":[],\"role\":\"user\",\"timestamp\":1779387660,\"content\":\"tôi tên khánh\",\"models\":[\"GLM-5.1\"]}},\"currentId\":\"45742a9e-5231-47d7-a3b9-2a78059b5add\"},\"tags\":[],\"features\":[{\"type\":\"tool_selector\",\"server\":\"tool_selector_h\",\"status\":\"hidden\"}],\"timestamp\":1779387660547,\"extra\":{}},\"updated_at\":1779387667,\"created_at\":1779387667,\"share_id\":null,\"archived\":false,\"pinned\":false,\"meta\":{\"auto_web_search\":false,\"flags\":null,\"mcp_servers\":[],\"models\":[\"GLM-5.1\"],\"workspace_id\":\"3b1eb71e-d0ab-44b1-a49d-7cb1b4d01890\"},\"folder_id\":null,\"message_version\":1,\"type\":\"default\",\"im_context\":null}"
}

POST https://chat.z.ai/api/v2/chat/completions?timestamp=1779387667865&requestId=29e995f1-63df-4b95-90f4-da6628778ad2&user_id=d8230254-6817-4906-b889-169e4d282739&version=0.0.1&platform=web&token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg&user_agent=Mozilla%2F5.0+%28X11%3B+Linux+x86_64%29+AppleWebKit%2F537.36+%28KHTML%2C+like+Gecko%29+Chrome%2F146.0.0.0+Safari%2F537.36&language=en-US&languages=en-US%2Cen&timezone=Asia%2FSaigon&cookie_enabled=true&screen_width=1920&screen_height=1080&screen_resolution=1920x1080&viewport_height=958&viewport_width=1920&viewport_size=1920x958&color_depth=24&pixel_ratio=1&current_url=https%3A%2F%2Fchat.z.ai%2Fc%2F3b1eb71e-d0ab-44b1-a49d-7cb1b4d01890&pathname=%2Fc%2F3b1eb71e-d0ab-44b1-a49d-7cb1b4d01890&search=&hash=&host=chat.z.ai&hostname=chat.z.ai&protocol=https%3A&referrer=https%3A%2F%2Faccounts.google.com.vn%2F&title=Z.ai+-+Free+AI+Chatbot+%26+Agent+powered+by+GLM-5.1+%26+GLM-5&timezone_offset=-420&local_time=2026-05-21T18%3A21%3A07.865Z&utc_time=Thu%2C+21+May+2026+18%3A21%3A07+GMT&is_mobile=false&is_touch=false&max_touch_points=10&browser_name=Chrome&os_name=Linux&signature_timestamp=1779387667865

{
  "request": {
    "host": "chat.z.ai",
    "connection": "keep-alive",
    "content-length": "1212",
    "x-fe-version": "prod-fe-1.1.35",
    "sec-ch-ua-platform": "\"Linux\"",
    "authorization": "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg",
    "accept-language": "en-US",
    "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
    "sec-ch-ua-mobile": "?0",
    "x-signature": "aaeef097b33c4a058406c53dd9ff2f47224fa1b1a0a50355e8c21695d9f2d97e",
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "content-type": "application/json",
    "x-region": "overseas",
    "accept": "*/*",
    "origin": "https://chat.z.ai",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "accept-encoding": "gzip, deflate, br, zstd",
    "cookie": "_ga=GA1.1.1497463483.1768536216; _c_WBKFRo=z6L5HQ8NqlfI5LfqLFB33Wf3tCrXzhu8H8v3WSxh; cdn_sec_tc=6b9b361517793873295171181e244dc34803b09d51dc12dc41b39d76fb; acw_tc=0a094e7017793873294823794e3e953ecac1d1c5a956748b9f18c43de617d1; _gcl_au=1.1.379539313.1779387361; oauth_id_token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjQxYjJlMTFmZjljYTI2ZTc4YzAyNWE5ZDRhNDI5Y2IwNjAxMzk1NmUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI4MDA0MjQzOTE5MjgtcXNxOTZ2YTN0cHVmcTRhamE4YTRhYmlvYm05MTBha3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI4MDA0MjQzOTE5MjgtcXNxOTZ2YTN0cHVmcTRhamE4YTRhYmlvYm05MTBha3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTE0NTA4NDA0NDk1MzcxMjg5NzgiLCJlbWFpbCI6InRoaWVuYmFvdm4yNDY4QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiQ09WdEJRX3JLXzVGd3VWeHV2N3MtdyIsIm5hbWUiOiJC4bqjbyBUaGnDqm4iLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jSnFOYmIxaVJXbGV6UVdCb2drRkxvdXJWTFpqRXh0Ry1lM2tId2JxNVdHWmJFUHpnPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6IkLhuqNvIiwiZmFtaWx5X25hbWUiOiJUaGnDqm4iLCJpYXQiOjE3NzkzODczOTgsImV4cCI6MTc3OTM5MDk5OH0.aJ5a5NUuW35Bwdq6pWmfUDCx2XBSRGuLsW-7g49f5nC0CtfX2gwsX1lgJ7JKr7127jzS6z4PqY1ZAPdVZ7gLRno9qL7qr52JiOvKP3FMhBUqyEcUv1QdqtUDyyTpT5AdkEqIt7ePO5ChdGcWaimqoCmvKCxdivJDwn91WukYK8DO3mzhAefCHKBwLmfQmpb2MM3IKmP-3KP7bx1mGOgbCSBGbLhIYKVGU22wkKa9dwAGvvghyl2AdOlUfSJkUGcRafwD8szQfWAUFhsZlcl3D92itZoEw_cw8JsBuT3_ffOBudfqzxGgeqAzYLGS9N5V93dVPfiMKZ5RNVH4jdRK1w; token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ4MjMwMjU0LTY4MTctNDkwNi1iODg5LTE2OWU0ZDI4MjczOSIsImVtYWlsIjoidGhpZW5iYW92bjI0NjhAZ21haWwuY29tIn0.xHP9E2QjUIv8T3YwO3YbCVKFTSz07j0A0XComnBEOTX0Wnag7ryAZcKM79JnG89gxtHa1MeRqTib1wz3Hy64Jg; _ga_Z8QTHYBHP3=GS2.1.s1779387281$o8$g1$t1779387668$j5$l0$h0; ssxmod_itna=1-Qq_x0DnQYCqYqAKitG0YbiOYG7kGO7DwrxGqGHDyh6xQ5DODLxn_qGdqcemUIeQQbKi_2DobGBDhoebD7TNDlrD_oQDCTKGfDQpoOYC7AHTKKGQpGW5DonTb7EKYOiSkS5oxptZd0NQXtVbYXZQh3D74Gnj4GSDDNDD2rb84GX8bETDYYDC4GwteG_GeDWDYoLDGtQDG=D7xbD84qFADbWHpabxi3DbgFDmdrFBZHD04qYZe73DDtDid2i7EWDA4WpL9hzhPGv8/3jq1dY2OkAleGyb5Gu7=OWqEIb26cz=ooAbRe2eq4E3DomD4Q0D0moFDqi_eQDxY0DSxeIDxC0iGGb8w7RAo_aN87N8T7F4xz_S8yMUpamvothqcuddnDziTQTTK_eQeKVriKbT8bii0TIGT8ieCG525t1qWKDbi0Cl2Nm_hSxVQxtp2K=GDD; ssxmod_itna2=1-Qq_x0DnQYCqYqAKitG0YbiOYG7kGO7DwrxGqGHDyh6xQ5DODLxn_qGdqcemUIeQQbKi_2DobGBDhoebD7woD=OfEb4iine03xrm=RDK=D0vhjeQXijjxOdN0h8KOpE10Dc1pr3k8OvHu54_ZyO=r_8V2KePAIeu1xsQG5eu2Dp7EIhN80z9cBz/pWGY_iOhFy1vtvet0HfeGiLR0i14S5FuxrvX8GFLakIRbDkzbqkRiOs5lALfrEswFIkE98OQE926FjXekLX8VSs1aQxVpj6/WOunlCRWkSBWVClfgGjwwUCD9vAYX/kuxacMNGqrM2=gkteMaW4hqj=VuriTOblCObhLTseqtSOtBdturk94Wnq8teinYdi0D7qwmwOSBtbk1e8WEQpXxrQd=5MQYGD=rQGfGtidtmeMxF=qF8k8q4EOEo_Cip3dm0EqLQj8EC3fDLovEA=w=v2TvEQqTIijob4i1bivEixpDRRxt3=qThR2TG4Aw3Nnq6FcF123lhwjo49QUteQ=atbc5mhOogiAChcdH9l7xzvCWF3_pI3jtibwIN=rnhjO0M0_g7M8iLRcRSUyrFMai6KX89TIfkRzs0gyrup0r78xxVj57xoqA526xW_evgfq46byfavppuQOvSI2DyOO0Rb8HpbfMpsSrslA1r6b4EM=Hxtf5/ko1bBim5Gm0r9qq012pVgYquChFKDemCDe1hWq4w6GOh4n350uatd78=YiigDhnRGBDDp5RsiDarDiB7AqupemzpKyaDncGYxqRDm8bPYUGG7jDhbDyaWWcDfdTxxjetiN7DI0anqViiQe=rT0PNxb_m9wo7HdEDD",
    "content-encoding": "none"
  },
  "response": {
    "server": "ESA",
    "content-type": "text/event-stream; charset=utf-8",
    "transfer-encoding": "chunked",
    "connection": "keep-alive",
    "date": "Thu, 21 May 2026 18:21:10 GMT",
    "vary": "Accept-Encoding, Accept-Encoding, Origin",
    "via": "ens-cache17.l2sg7[1322,0,DP], ens-cache28.l2vn4[1346,0,DP], ens-cache11.vn37[1347,0,DP], ens-cache11.vn37[1348,0]",
    "x-site-cache-status": "DYNAMIC",
    "x-process-time": "1",
    "access-control-allow-origin": "https://chat.z.ai",
    "access-control-allow-credentials": "true",
    "access-control-expose-headers": "X-Chat-Id, X-Trace-ID",
    "x-trace-id": "19e4bc51bcb751d5",
    "timing-allow-origin": "*",
    "eagleid": "6b9b361f17793876694914426e"
  }
}

{
  "request": "{\"stream\":true,\"model\":\"GLM-5.1\",\"messages\":[{\"role\":\"user\",\"content\":\"tôi tên khánh\"}],\"signature_prompt\":\"tôi tên khánh\",\"params\":{},\"extra\":{},\"features\":{\"image_generation\":false,\"web_search\":false,\"auto_web_search\":false,\"preview_mode\":true,\"flags\":[],\"vlm_tools_enable\":false,\"vlm_web_search_enable\":false,\"vlm_website_mode\":false,\"enable_thinking\":false},\"variables\":{\"{{USER_NAME}}\":\"ThienBao\",\"{{USER_LOCATION}}\":\"Unknown\",\"{{CURRENT_DATETIME}}\":\"2026-05-22 01:21:09\",\"{{CURRENT_DATE}}\":\"2026-05-22\",\"{{CURRENT_TIME}}\":\"01:21:09\",\"{{CURRENT_WEEKDAY}}\":\"Friday\",\"{{CURRENT_TIMEZONE}}\":\"Asia/Saigon\",\"{{USER_LANGUAGE}}\":\"en-US\"},\"chat_id\":\"3b1eb71e-d0ab-44b1-a49d-7cb1b4d01890\",\"id\":\"63925e96-1a97-4197-a954-1d0e3a8db55a\",\"current_user_message_id\":\"45742a9e-5231-47d7-a3b9-2a78059b5add\",\"current_user_message_parent_id\":null,\"background_tasks\":{\"title_generation\":true,\"tags_generation\":true},\"captcha_verify_param\":\"eyJjZXJ0aWZ5SWQiOiJPcmRKbHR3akR6Iiwic2NlbmVJZCI6ImRpZGszM2UwIiwiaXNTaWduIjp0cnVlLCJzZWN1cml0eVRva2VuIjoiNm9PbzdlNzJuQTYxdVZMaVpWS2lMWXFGMW05ck9ubzN2RUlQSkthTDdLTHhDSnFiMVVCd1JwbDRwN0VjRlRnZFVGS3RiV0t3NEQ3bzJEdHErU1V3SDlqUGNxYWZscWJRTFpRZFgycllkLzhiaG5xaElwQzdTblJsSXhHUHNxdlgifQ==\"}",
  "response": "data: {\"type\":\"chat:completion\",\"data\":{\"delta_content\":\"Chào Khánh!\",\"phase\":\"answer\"}}\n\ndata: {\"type\":\"chat:completion\",\"data\":{\"delta_content\":\" Rất vui được gặp\",\"phase\":\"answer\"}}\n\ndata: {\"type\":\"chat:completion\",\"data\":{\"delta_content\":\" bạn. Hôm nay\",\"phase\":\"answer\"}}\n\ndata: {\"type\":\"chat:completion\",\"data\":{\"delta_content\":\" bạn có cần tôi giúp\",\"phase\":\"answer\"}}\n\ndata: {\"type\":\"chat:completion\",\"data\":{\"delta_content\":\" gì không? 😊\",\"phase\":\"answer\"}}\n\ndata: {\"type\":\"chat:completion\",\"data\":{\"phase\":\"other\",\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":26,\"total_tokens\":36,\"prompt_tokens_details\":{}}}}\n\ndata: {\"type\":\"chat:completion\",\"data\":{\"phase\":\"done\",\"done\":true}}\n\n"
}