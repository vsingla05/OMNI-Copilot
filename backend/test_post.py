import requests
import base64

msg = "summarize this file"
filename = "auth.py"
content = "print('Hello World')".encode("utf-8")
b64 = base64.b64encode(content).decode("utf-8")
image_data = f"{filename}|||text/x-python|||{b64}"

r = requests.post("http://localhost:57671/chat", json={
    "message": msg,
    "context": "code",
    "image_data": image_data
})
print("Result:", r.json())
