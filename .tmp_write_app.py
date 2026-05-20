
import base64
with open(r'D:\\Projects\\boro\\.tmp_app_b64.txt', 'r') as f:
    data = f.read().replace('
', '').replace('', '')
with open(r'D:\\Projects\\boro\\src\\renderer\\src\\App.tsx', 'wb') as f:
    f.write(base64.b64decode(data))
print('written', r'D:\\Projects\\boro\\src\\renderer\\src\\App.tsx')
