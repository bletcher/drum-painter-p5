HOW TO INCLUDE YOUR SAVED SETTINGS IN THE BUILD
=================================================

To ensure your customized drum settings are included when you deploy:

1. Run the app in development mode (npm run dev)

2. Make sure your settings are configured the way you want them

3. Click the "Save" button in the customization panel to save to localStorage

4. Click "Export Settings" to download your settings as a JSON file

5. Rename the downloaded file to: default-settings.json

6. Place it in this /public directory (replace this README.txt)

7. Run: npm run build

8. The default-settings.json file will be included in the /dist folder

9. When users access your deployed app, if they have no localStorage data,
   the app will automatically load settings from default-settings.json

Note: Files in the /public directory are automatically copied to /dist during build.
