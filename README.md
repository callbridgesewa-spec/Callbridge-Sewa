## CallBridge Admin – Appwrite Setup

This project uses **Appwrite** for authentication, user roles, and badge count storage.

---

### 1. Prerequisites

- Appwrite project (Cloud or self-hosted)
- Admin access to:
  - **Authentication** → Users
  - **Database** → Databases & Collections

---

### 2. Create Appwrite Project

1. Go to Appwrite console and create a new **Project** (or use an existing one).
2. Note the:
   - **Project ID**
   - **API Endpoint** (`https://cloud.appwrite.io/v1` for Appwrite Cloud)

You will use these in `.env` later.

---

### 3. Database & Collections

#### 3.1 Create Database

1. In Appwrite console, go to **Database**.
2. Click **Create Database**.
3. Name it (e.g. `callbridge-db`) and note its **Database ID**.

#### 3.2 Users Collection (for roles)

Used to store roles for each Appwrite user.

1. Inside your database, click **Create Collection**.
2. Name it (e.g. `users`) and note its **Collection ID**.
3. Add attributes:
   - `userId` – **string**, required  
   - `role` – **string**, required (expected values: `admin` or `user`)
4. Permissions (simple option for internal app):
   - Allow **read & write** for users with role `admin` (you can use Appwrite permissions / teams).
   - Optionally restrict read for normal users depending on your security needs.

When your admin creates a new Appwrite user, also create a document in this collection with:
- `userId` = the user’s `$id` from Appwrite
- `role` = `"admin"` or `"user"`

#### 3.3 Badge Counts Collection

Stores the dashboard badge counts.

1. In the same database, click **Create Collection**.
2. Name it (e.g. `badge-counts`) and note its **Collection ID**.
3. Add attributes (all **integer** or **double**, required):
   - `open`
   - `permanent`
   - `elderly`
   - `sangat`
   - `newProspects`
4. Permissions:
   - Allow **read & write** for admin users (same as users collection).

You can optionally create a single initial document with ID `badge-counts` and initial numeric values.  
If you don’t, the app will start with built-in default values and create a document on first save.

---

### 4. Authentication & Roles Model

- **No signup page** in the app.
- Admin creates users in Appwrite (console or SDK).
- For each Appwrite user:
  1. Create the user (email + password).
  2. Create a document in the **Users collection**:
     - `userId`: the Appwrite user `$id`
     - `role`: `"admin"` or `"user"`

The app determines the role by:
1. Looking up the user’s document in the **Users collection** (preferred).
2. If the collection isn’t configured, it falls back to **user labels** and treats `admin` label as admin.

---

### 5. Environment Variables

In the project root, create a `.env.local` file:

VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=YOUR_PROJECT_ID
VITE_APPWRITE_DATABASE_ID=YOUR_DATABASE_ID
VITE_APPWRITE_BADGE_COLLECTION_ID=YOUR_BADGE_COLLECTION_ID
VITE_APPWRITE_USERS_COLLECTION_ID=YOUR_USERS_COLLECTION_ID
