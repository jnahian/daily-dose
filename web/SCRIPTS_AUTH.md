# Scripts Documentation Authentication

## Overview

The scripts documentation page (`/scripts`) is protected with basic authentication to restrict access to administrators only.

## Setup

### 1. Environment Variables

Create a `.env` file in the `web` directory with the following variables:

```bash
VITE_ADMIN_USERNAME=your_username
VITE_ADMIN_PASSWORD=your_secure_password
```

**Default credentials** (if not set):
- Username: `admin`
- Password: `admin123`

⚠️ **Important**: Change these default values in production!

### 2. How It Works

- Authentication uses session storage to maintain login state
- Credentials are checked against environment variables
- Session persists until the browser tab is closed or user logs out
- Failed login attempts clear the password field and show an error message

### 3. User Experience

**Login Screen:**
- Clean, dark-themed authentication form
- Username and password fields
- Show/hide password toggle
- Error messages for failed attempts
- Responsive design

**Authenticated State:**
- Full access to scripts documentation
- Small logout button in bottom-left corner (desktop only)
- Session maintained across page refreshes

### 4. Security Notes

- This is **basic authentication** for demonstration purposes
- Credentials are stored in environment variables
- Session token is stored in browser's session storage
- **Not suitable for production** without additional security measures

### 5. Production Recommendations

For production use, consider:
- Implementing proper OAuth/SSO integration
- Using a backend authentication service
- Adding rate limiting for login attempts
- Implementing HTTPS-only cookies
- Adding multi-factor authentication
- Using a proper user management system

## Usage

1. Navigate to `/scripts`
2. Enter admin credentials
3. Click "Sign In"
4. Access scripts documentation
5. (Optional) Click "Logout" button to sign out

## Development

The authentication component is located at:
- `src/components/auth/BasicAuth.tsx`

To bypass authentication during development, you can temporarily modify the component or use the default credentials.
