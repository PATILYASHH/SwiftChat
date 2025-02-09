{
     "scripts": {
       "start": "node server/index.js",
       "build": "tsc"
     }
   }
   ```

5. Update CORS settings in your backend code to allow your Vercel frontend domain:
   ```typescript
   app.use(cors({
     origin: process.env.FRONTEND_URL || 'https://your-vercel-app.vercel.app',
     credentials: true
   }));