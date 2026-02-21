HOW TO INCLUDE YOUR SAVED SETTINGS IN THE BUILD
=================================================

To ensure your customized drum settings are included when you deploy:

1. Run the app in development mode (npm run dev)

2. Configure your settings (they auto-save to browser localStorage)

3. Click "Export to File" at the bottom of the Customize Drums panel

4. Rename the downloaded file to: default-settings.json

5. Place it in this /public directory

6. Run: npm run build

7. The default-settings.json file will be included in the /dist folder

8. When users access your deployed app, if they have no localStorage data,
   the app will automatically load settings from default-settings.json

Note: Files in the /public directory are automatically copied to /dist during build.
