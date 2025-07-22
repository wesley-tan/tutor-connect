import { PrismaClient } from '@tutorconnect/database';
import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';

export class AuthService {
  private prisma: PrismaClient;
  private supabase: ReturnType<typeof createClient>;
  private googleClient: OAuth2Client;

  constructor() {
    this.prisma = new PrismaClient();
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  async authenticateWithGoogle(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID || []
      });

      const payload = ticket.getPayload()!;
      
      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { email: payload.email! }
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: payload.email!,
            firstName: payload.given_name!,
            lastName: payload.family_name!,
            profileImageUrl: payload.picture || null,
            userType: 'student', // Default to student, can be changed later
            isVerified: true,
            passwordHash: '' // Not needed for OAuth
          }
        });

        logger.info('Created new user via Google OAuth', {
          userId: user.id,
          email: user.email
        });
      }

      // Create Supabase user if doesn't exist
      const { data: supabaseUser, error: supabaseError } = await this.supabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: {
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          profileImageUrl: user.profileImageUrl
        }
      });

      if (supabaseError) {
        logger.error('Error creating Supabase user', {
          error: supabaseError,
          userId: user.id
        });
        throw supabaseError;
      }

      return {
        user,
        session: supabaseUser
      };
    } catch (error) {
      logger.error('Error in Google authentication', { error });
      throw error;
    }
  }

  async sendMagicLink(email: string) {
    try {
      const { data, error } = await this.supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo: `${process.env.FRONTEND_URL}/auth/callback`
        }
      });

      if (error) {
        logger.error('Error generating magic link', { error, email });
        throw error;
      }

      // Find or create user
      let user = await this.prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email,
            firstName: '',
            lastName: '',
            userType: 'student', // Default to student, can be changed later
            isVerified: false,
            passwordHash: '' // Not needed for magic links
          }
        });

        logger.info('Created new user for magic link', {
          userId: user.id,
          email
        });
      }

      return {
        user,
        magicLink: data
      };
    } catch (error) {
      logger.error('Error sending magic link', { error, email });
      throw error;
    }
  }

  async verifySession(token: string) {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error) {
        logger.error('Error verifying session', { error });
        throw error;
      }

      if (!user) {
        logger.error('No user found for session');
        throw new Error('Invalid session');
      }

      // Get user from database
      const dbUser = await this.prisma.user.findUnique({
        where: { email: user.email! }
      });

      if (!dbUser) {
        logger.error('No database user found for session', {
          email: user.email
        });
        throw new Error('User not found');
      }

      return {
        user: dbUser,
        session: user
      };
    } catch (error) {
      logger.error('Error in session verification', { error });
      throw error;
    }
  }
} 