# VSCode Debugging Setup Guide

This guide covers multiple ways to debug the LocalAI Admin Dashboard with VSCode breakpoints.

## ✅ What Was Fixed

1. **Multiple redirect URLs** added to Supabase Auth configuration
2. **Admin password reset** to `AdminPass2024!`
3. **Source maps enabled** in Vite config for debugging
4. **Docker dev environment** configured with hot reload
5. **VSCode launch configurations** for both local and Docker debugging

---

## 🔐 Login Credentials

```
Email: admin@fetchtext.local
Password: AdminPass2024!
```

---

## 🎯 Option 1: Local Development (Recommended for Quick Iteration)

### Start the Dev Server
```bash
cd localai-admin-dashboard
pnpm dev
```

### Debug in VSCode
1. Open VSCode Debug panel (Cmd+Shift+D)
2. Select **"Dev: Vite + Debug Chrome"** compound launcher
3. Click Start (F5)
4. Set breakpoints in your TypeScript files
5. The browser will open at http://localhost:5173

### Breakpoint Locations to Test
- [user-auth-form.tsx:55](src/features/auth/sign-in/components/user-auth-form.tsx#L55) - Login submission
- [supabase.ts:19](src/lib/supabase.ts#L19) - Supabase client creation

---

## 🐳 Option 2: Docker Development (Best for Production Parity)

### Why Use Docker Dev Mode?
- **Same environment** as production
- **Hot reload** - changes to `src/` files are reflected immediately
- **No local Node.js** dependencies needed
- **Network isolation** - uses same Docker network as Supabase

### Start Docker Dev Environment
```bash
cd localai-admin-dashboard
./scripts/start-docker-dev.sh
```

Or manually:
```bash
cd localai-admin-dashboard
docker compose -f docker-compose.dev.yml up --build
```

### Debug in VSCode
1. Ensure Docker dev container is running (http://localhost:5174)
2. Open VSCode Debug panel
3. Select **"Chrome: Docker Dev"**
4. Click Start (F5)
5. Set breakpoints in TypeScript source files

### How It Works
- **Volume mounts** sync `src/` files to container in real-time
- **Vite HMR** detects changes and hot-reloads
- **Source maps** map compiled JS back to TypeScript files
- **VSCode debugger** connects to Chrome DevTools Protocol

### File Changes That Auto-Reload
- ✅ `src/**/*.tsx` - React components
- ✅ `src/**/*.ts` - TypeScript modules
- ✅ `src/**/*.css` - Stylesheets
- ❌ `package.json` - requires rebuild
- ❌ `vite.config.ts` - requires restart

---

## 🔧 Option 3: Attach to Existing Browser

For advanced debugging scenarios.

### Start Chrome with Remote Debugging
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug \
  http://localhost:5173
```

### Attach VSCode Debugger
1. Navigate to sign-in page manually
2. Open VSCode Debug panel
3. Select **"Attach: Chrome"**
4. Click Start
5. Set breakpoints

---

## 🧪 Testing the Setup

### 1. Test Login Locally
```bash
cd localai-admin-dashboard
pnpm dev
```
- Navigate to http://localhost:5173
- Login with: `admin@fetchtext.local` / `AdminPass2024!`
- Should redirect to dashboard

### 2. Test Login in Docker
```bash
cd localai-admin-dashboard
docker compose -f docker-compose.dev.yml up --build
```
- Navigate to http://localhost:5174
- Login with same credentials
- Should redirect to dashboard

### 3. Test Breakpoints
1. Set breakpoint in [user-auth-form.tsx:55](src/features/auth/sign-in/components/user-auth-form.tsx#L55)
2. Start appropriate debugger
3. Submit login form
4. Debugger should pause at breakpoint
5. Inspect variables: `data.email`, `data.password`, `authData`

---

## 🐛 Troubleshooting

### Breakpoints Show as Gray/Unbound

**Cause**: Source maps not loaded correctly

**Fix**:
1. Restart Vite dev server
2. Clear browser cache (Cmd+Shift+R)
3. Restart VSCode debugger
4. Check source maps are generated: `ls -la dist/assets/*.js.map`

### Login Still Fails

**Check Auth Service**:
```bash
docker logs supabase-auth --tail 50
```

**Check Environment Variables**:
```bash
grep VITE_SUPABASE localai-admin-dashboard/.env.local
grep ANON_KEY .env
```

**Verify Password**:
```bash
# Reset password if needed
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT email FROM auth.users WHERE email='admin@fetchtext.local';"
```

### Docker Dev Server Won't Start

**Check Port Conflicts**:
```bash
lsof -i :5174
```

**Check Network Exists**:
```bash
docker network ls | grep local-ai
```

**Rebuild Container**:
```bash
cd localai-admin-dashboard
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up --build --force-recreate
```

---

## 📝 Configuration Files Modified

1. **[.env](.env#L169-L170)** - Added multiple redirect URLs
2. **[vite.config.ts](vite.config.ts#L18-L20)** - Enabled source maps
3. **[launch.json](../.vscode/launch.json)** - Added debug configurations
4. **[docker-compose.dev.yml](docker-compose.dev.yml)** - Enhanced dev setup

---

## 🎓 VSCode Debugging Tips

### Inspect Variables
- Hover over variables while paused
- Use Debug Console (Cmd+Shift+Y)
- Type expressions: `authData.user.email`

### Step Through Code
- **F10** - Step Over (execute current line)
- **F11** - Step Into (enter function)
- **Shift+F11** - Step Out (exit function)
- **F5** - Continue (resume execution)

### Conditional Breakpoints
- Right-click breakpoint
- Select "Edit Breakpoint"
- Add condition: `data.email.includes('admin')`

### Logpoints (No Code Changes)
- Right-click in gutter
- Select "Add Logpoint"
- Enter: `Login attempt: {data.email}`
- Logs appear in Debug Console

---

## 🚀 Quick Reference

| Mode | URL | Command | Use Case |
|------|-----|---------|----------|
| Local Dev | http://localhost:5173 | `pnpm dev` | Quick iteration |
| Docker Dev | http://localhost:5174 | `./scripts/start-docker-dev.sh` | Production parity |
| Production | http://localhost:3005 | `docker compose up` | Final testing |

---

## 📚 Additional Resources

- [VSCode Debugging Docs](https://code.visualstudio.com/docs/editor/debugging)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Vite Source Maps](https://vitejs.dev/config/build-options.html#build-sourcemap)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
