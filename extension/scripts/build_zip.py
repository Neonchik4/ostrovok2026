import os
import zipfile

def build_zip():
    ext_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_zip = os.path.join(ext_dir, "ostrovok-copilot-extension.zip")

    files_to_pack = [
        "manifest.json",
        "background.js",
        "content.bundle.js",
        "styles.css",
        "icons/icon16.png",
        "icons/icon48.png",
        "icons/icon128.png",
    ]

    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for rel_path in files_to_pack:
            full_path = os.path.join(ext_dir, rel_path)
            if os.path.exists(full_path):
                z.write(full_path, rel_path)
                print(f"Packed: {rel_path}")
            else:
                print(f"Warning: {rel_path} not found")

    print(f"\nSuccessfully created {output_zip} ({os.path.getsize(output_zip)} bytes)")

if __name__ == "__main__":
    build_zip()
