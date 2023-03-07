import { type GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
} from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { env } from "~/env.mjs";
import { prisma } from "~/server/db";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { type AppRouter } from "~/server/api/root";

const client = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: env.NEXTAUTH_URL + "/api/trpc",
      headers() {
        return {
          pass: 'env.SERVER_SECRET',
        };
      },
    }),
  ],
});
/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  //interface Session extends DefaultSession {
  interface Session {
    // user: {
    //   id: string;
    //   // ...other properties
    //   // role: UserRole;
    // } & DefaultSession["user"];
    user: {
      id: string;
      username: string;
      email: string;
      // ...other properties
      // role: UserRole;
    };
  }

   interface User {
     user: {
       id: string;
       username: string;
       email: string;
       // ...other properties
       // role: UserRole;
     };
   }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  callbacks: {
    // session({ session, user }) {
    //   console.log(session)
    //   if (session.user) {
    //     session.user.id = user.id;
    //     // session.user.role = user.role; <-- put other properties on the session here
    //   }
    //   return session;
    // },
    session(x) {
      console.log(x)
      return x;
    },
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      id: "Credentials",
      // The name to display on the sign in form (e.g. 'Sign in with...')
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text", placeholder: "usernameHolder" },
        password: {  label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials) throw new Error("Invalid login");
        const body = {
          username: credentials.username,
          password: credentials.password,
        };
        //
        const user =  await client.user.signIn.mutate(body);
        // If no error and we have user data, return it
        if (user) {
          return {
            user
          }
        }
        // Return null if user data could not be retrieved
        return null
      }
    })
  ],
  session: {
    strategy: "jwt"
  }
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
