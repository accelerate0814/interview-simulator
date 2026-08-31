# README

**asr tob 相关client demo**

# Notice
python version: python 3.x

## 运行

### 调用流式语音识别 SAUC

#### 新版控制台鉴权（X-Api-Key）
```
python3 sauc_websocket_demo.py \
--url=wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream \
--api_key=<api_key> \
--resource_id=volc.bigasr.sauc.duration \
--file=<audio_file_path>
```

#### 老版控制台鉴权（App-Key + Access-Key）
```
python3 sauc_websocket_demo.py \
--url=wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream \
--app_key=<app_id> \
--access_key=<access_key> \
--resource_id=volc.bigasr.sauc.duration \
--file=<audio_file_path>
```
