import { Client, Databases, Account, ID } from "appwrite";

// 1. Initialize the Client
const client = new Client();

client
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!) // Your API Endpoint
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!); // Your Project ID

// 2. Export the services you need
export const databases = new Databases(client);
export const account = new Account(client);

// 3. Re-export ID so you can use ID.unique() in your components
export { ID };
