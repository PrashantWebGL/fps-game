# Deployment Guide: Epic Shooter 3D

Since this game uses a **Node.js/Socket.IO backend**, you cannot deploy the entire project to Vercel alone (Vercel is primarily for static sites and serverless functions). You need two separate deployments:

## 1. Deploy the Backend (Multiplayer Server)
We recommend using **Render.com** or **Railway.app** for the server.

### Steps for Render.com:
1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Set the following configurations:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Render will provide you with a URL (e.g., `https://my-fps-server.onrender.com`).

> [!IMPORTANT]
> Once you have the server URL, you **must** update the `serverUrl` in `src/MultiplayerManager.js`:
> ```javascript
> // Inside MultiplayerManager.js constructor:
> this.serverUrl = 'https://my-fps-server.onrender.com';
> ```

---

## 2. Deploy the Frontend (Game UI)
You can use **Vercel** for the frontend.

### Steps for Vercel:
1. Go to [Vercel](https://vercel.com) and create a new project.
2. Connect your GitHub repository.
3. Vercel will auto-detect **Vite**.
4. Set the **Build Command**: `npm run build`
5. Set the **Output Directory**: `dist`
6. Click **Deploy**.

---

## 3. Deployment Checklist
- [ ] Ensure `server.js` uses `process.env.PORT || 3001`.
- [ ] Update `src/MultiplayerManager.js` to point to your *live* backend URL.
- [ ] In `server.js`, ensure CORS allows your Vercel frontend URL:
  ```javascript
  const io = new Server(httpServer, {
      cors: {
          origin: "https://your-game-url.vercel.app", // Use "*" for testing
          methods: ["GET", "POST"]
      }
  });
  ```
- [ ] Push changes to GitHub; both services will auto-deploy.
