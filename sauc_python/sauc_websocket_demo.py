import asyncio
import json
import protocol
import argparse

async def main():
    parser = argparse.ArgumentParser(description="ASR WebSocket Client")
    parser.add_argument("--file", type=str, required=True, help="Audio file path")

    # wss://openspeech.bytedance.com/api/v3/sauc/bigmodel
    # wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async
    # wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream
    parser.add_argument("--url", type=str, default="wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream",
                        help="WebSocket URL")
    parser.add_argument("--seg-duration", type=int, default=200,
                        help="Audio duration(ms) per packet, default:200")
    parser.add_argument("--api_key", type=str, default="",
                        help="API key for authorization (new console auth, X-Api-Key)")
    parser.add_argument("--app_key", type=str, default="",
                        help="App key (legacy console auth, used with access_key)")
    parser.add_argument("--access_key", type=str, default="",
                        help="Access key for authorization (legacy console auth, used with app_key)")
    parser.add_argument("--resource_id", type=str, default="volc.bigasr.sauc.duration",
                        help="X-Api-Resource-Id")

    args = parser.parse_args()
    if not args.api_key and (not args.app_key or not args.access_key):
        raise ValueError("auth required: provide --api_key, or --app_key + --access_key")

    config = protocol.Config(
        api_key=args.api_key,
        app_key=args.app_key,
        access_key=args.access_key,
        resource_id=args.resource_id,
    )
    payload = {
        "user": {
            "uid": "demo_uid"
        },
        "audio": {
            "format": "wav",
            "codec": "raw",
            "rate": 16000,
            "bits": 16,
            "channel": 1
        },
        "request": {
            "model_name": "bigmodel",
            "enable_itn": True,
            "enable_punc": True,
            "enable_ddc": True,
            "show_utterances": True,
            "enable_nonstream": False
        }
    }
    async with protocol.AsrWsClient(args.url, args.seg_duration) as client:  # 使用async with
        try:
            async for response in client.execute(args.file,config,payload):
                protocol.logger.info(f"Received response: {json.dumps(response.to_dict(), indent=2, ensure_ascii=False)}")
        except Exception as e:
            protocol.logger.error(f"ASR processing failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())