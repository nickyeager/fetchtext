# Chrome DevTools MCP Server Setup

**Purpose**: Enable Claude Code to automate browser interactions for testing, including automatic login to the LocalAI Admin Dashboard.

**Repository**: https://github.com/ChromeDevTools/chrome-devtools-mcp/

---

## Prerequisites

1. **Node.js 18+** installed on your system
2. **Chrome browser** installed
3. **Claude Code** (Desktop or CLI)

---

## Installation Steps

### 1. Install Node.js and npm (if not already installed)

**macOS** (using Homebrew):
```bash
brew install node@20
```

**Verify installation**:
```bash
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### 2. Install Chrome DevTools MCP Server

The MCP server can be installed globally or used via npx. We'll use the npx method for easier updates.

**Test if npx works**:
```bash
npx --version
```

### 3. Configure Claude Code to Use the MCP Server

Create or edit your Claude Code MCP configuration file:

**Location**: `~/.config/claude/mcp.json` (Linux/macOS) or `%APPDATA%/claude/mcp.json` (Windows)

**Create the directory if it doesn't exist**:
```bash
mkdir -p ~/.config/claude
```

**Create/Edit `~/.config/claude/mcp.json`**:
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "@chromedevtools/mcp-server-chrome-devtools"
      ],
      "env": {
        "CHROME_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      }
    }
  }
}
```

**For Linux**, adjust `CHROME_PATH`:
```json
"CHROME_PATH": "/usr/bin/google-chrome"
```

**For Windows**, adjust `CHROME_PATH`:
```json
"CHROME_PATH": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
```

### 4. Restart Claude Code

After saving the configuration, restart Claude Code to load the MCP server.

### 5. Verify MCP Server is Loaded

In Claude Code, check available MCP tools by asking:
```
What MCP tools do you have access to?
```

You should see Chrome DevTools tools like:
- `use_browser` - Control Chrome browser
- `navigate` - Navigate to URLs
- `click` - Click elements
- `type` - Type text into inputs
- `screenshot` - Take screenshots
- etc.

---

## Usage with LocalAI Admin Dashboard

Once configured, Claude Code can automate browser interactions. Here's how to test login:

### Example: Automated Login Test

**Ask Claude Code**:
```
Use the Chrome DevTools MCP to:
1. Open http://localhost:5173/sign-in
2. Fill in the email: test.user@example.com
3. Fill in the password: [your test password]
4. Click the login button
5. Take a screenshot of the result
```

Claude Code will use the `use_browser` tool to:
1. Launch Chrome in debug mode
2. Navigate to the login page
3. Find and interact with form elements
4. Submit the form
5. Capture the results

---

## Configuration Options

### Custom Chrome Path

If Chrome is installed in a non-standard location, update `CHROME_PATH` in the MCP config:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@chromedevtools/mcp-server-chrome-devtools"],
      "env": {
        "CHROME_PATH": "/path/to/your/chrome/executable"
      }
    }
  }
}
```

### Using Chrome Canary or Chromium

```json
"CHROME_PATH": "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
```

Or for Chromium:
```json
"CHROME_PATH": "/Applications/Chromium.app/Contents/MacOS/Chromium"
```

### Debug Mode

To see MCP server logs, run Claude Code with debug logging enabled.

---

## Troubleshooting

### Issue: "MCP server not found"

**Solution**: Verify npx is in your PATH:
```bash
which npx
npx --version
```

If not found, ensure Node.js is properly installed.

### Issue: "Chrome not found"

**Solution**: Verify Chrome path:
```bash
# macOS
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Linux
which google-chrome

# Windows
dir "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Update `CHROME_PATH` in mcp.json to the correct path.

### Issue: "Permission denied"

**Solution**: Ensure Chrome executable has execute permissions:
```bash
chmod +x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

### Issue: "MCP server crashes"

**Solution**:
1. Check Node.js version is 18+
2. Clear npm cache: `npm cache clean --force`
3. Try installing the package globally:
   ```bash
   npm install -g @chromedevtools/mcp-server-chrome-devtools
   ```
4. Update mcp.json to use global install:
   ```json
   {
     "mcpServers": {
       "chrome-devtools": {
         "command": "mcp-server-chrome-devtools"
       }
     }
   }
   ```

### Issue: "Browser automation fails"

**Solution**:
1. Ensure Chrome is not already running
2. Close all Chrome instances
3. Try again - the MCP server launches Chrome in debug mode which requires a fresh instance

---

## Testing the Setup

### Quick Test Script

Create a test file to verify the setup:

**test-chrome-mcp.md**:
```markdown
# Chrome DevTools MCP Test

Please use the Chrome DevTools MCP to:

1. Open http://example.com
2. Take a screenshot
3. Report what you see
```

Save this and ask Claude Code to follow the instructions.

### Expected Behavior

When working correctly:
1. Chrome opens automatically in debug mode
2. Navigation happens programmatically
3. Claude Code can read page content
4. Screenshots are captured and analyzed
5. Form interactions work smoothly

---

## Integration with FetchText Dashboard

### Pre-configured Test Scenarios

#### Scenario 1: Login Test
```json
{
  "task": "login-test",
  "url": "http://localhost:5173/sign-in",
  "credentials": {
    "email": "test.user@example.com",
    "password": "stored in environment"
  },
  "expected_redirect": "/dashboard"
}
```

#### Scenario 2: Document Upload Test
```json
{
  "task": "document-upload",
  "steps": [
    "Navigate to /documents",
    "Click upload button",
    "Select test file",
    "Verify upload progress",
    "Confirm success message"
  ]
}
```

#### Scenario 3: Template Creation
```json
{
  "task": "create-template",
  "steps": [
    "Navigate to /templates",
    "Click 'New Template'",
    "Fill template form",
    "Save template",
    "Verify in list"
  ]
}
```

---

## Advanced Usage

### Running Tests in Headless Mode

The MCP server can run Chrome in headless mode for CI/CD:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@chromedevtools/mcp-server-chrome-devtools"],
      "env": {
        "CHROME_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "CHROME_FLAGS": "--headless --disable-gpu"
      }
    }
  }
}
```

### Multi-Browser Testing

Configure multiple MCP servers for different browsers:

```json
{
  "mcpServers": {
    "chrome": {
      "command": "npx",
      "args": ["-y", "@chromedevtools/mcp-server-chrome-devtools"],
      "env": {
        "CHROME_PATH": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      }
    },
    "chrome-canary": {
      "command": "npx",
      "args": ["-y", "@chromedevtools/mcp-server-chrome-devtools"],
      "env": {
        "CHROME_PATH": "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
      }
    }
  }
}
```

---

## Security Considerations

### Important Notes

1. **Debug Mode**: Chrome runs in debug mode, which allows remote control
2. **Local Only**: Only use on localhost or trusted environments
3. **Credentials**: Never hardcode credentials in MCP configs
4. **Network**: The debug port is exposed locally (default: 9222)

### Best Practices

1. **Use environment variables** for sensitive data:
   ```json
   "env": {
     "TEST_USER_EMAIL": "${TEST_USER_EMAIL}",
     "TEST_USER_PASSWORD": "${TEST_USER_PASSWORD}"
   }
   ```

2. **Restrict debug port** to localhost only (default behavior)

3. **Close browser** after tests complete

4. **Avoid production** environments - use only for local development/testing

---

## Alternative: Playwright MCP

If Chrome DevTools MCP doesn't work, consider using the Playwright MCP server:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```

Playwright offers:
- Multi-browser support (Chrome, Firefox, Safari)
- Better stability for automation
- Built-in waiting and retry logic
- Screenshot and video recording

---

## Next Steps

After setup:

1. ✅ Verify MCP server loads in Claude Code
2. ✅ Test with simple navigation (http://example.com)
3. ✅ Test with localhost:5173 navigation
4. ✅ Test login automation
5. ✅ Create test scenarios for common workflows
6. ✅ Integrate with CI/CD if needed

---

## Resources

- **Chrome DevTools MCP**: https://github.com/ChromeDevTools/chrome-devtools-mcp/
- **MCP Documentation**: https://modelcontextprotocol.io/
- **Claude Code MCP Guide**: https://docs.anthropic.com/claude/docs/mcp
- **Chrome DevTools Protocol**: https://chromedevtools.github.io/devtools-protocol/

---

## Support

If you encounter issues:

1. Check the MCP server logs in Claude Code
2. Verify Node.js and Chrome versions
3. Test npx command manually:
   ```bash
   npx -y @chromedevtools/mcp-server-chrome-devtools
   ```
4. Review Chrome DevTools MCP issues: https://github.com/ChromeDevTools/chrome-devtools-mcp/issues

---

**Note**: This setup enables powerful browser automation capabilities. Use responsibly and only in development/testing environments.
