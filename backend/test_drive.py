import asyncio
from tools.drive_tools import upload_text_to_drive, delete_drive_file

async def main():
    print("Testing upload...")
    res = await upload_text_to_drive("test_omni.txt", "Hello world from Omni Copilot")
    print(f"Upload result: {res}")
    
    if "ID: " in res:
        file_id = res.split("ID: ")[1].strip()
        print(f"Testing delete for {file_id}...")
        del_res = await delete_drive_file(file_id)
        print(f"Delete result: {del_res}")

if __name__ == "__main__":
    asyncio.run(main())
