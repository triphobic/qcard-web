/**
 * Database Types for Supabase
 *
 * Generated from Prisma schema
 * These types match your database structure
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      User: {
        Row: {
          id: string
          email: string
          firstName: string | null
          lastName: string | null
          phoneNumber: string | null
          role: Database['public']['Enums']['UserRole']
          tenantId: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id: string
          email: string
          firstName?: string | null
          lastName?: string | null
          phoneNumber?: string | null
          role?: Database['public']['Enums']['UserRole']
          tenantId?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          email?: string
          firstName?: string | null
          lastName?: string | null
          phoneNumber?: string | null
          role?: Database['public']['Enums']['UserRole']
          tenantId?: string | null
          createdAt?: string
          updatedAt?: string
        }
      }
      Profile: {
        Row: {
          id: string
          userId: string
          headshotUrl: string | null
          bio: string | null
          height: string | null
          weight: string | null
          hairColor: string | null
          eyeColor: string | null
          availability: boolean
          createdAt: string
          updatedAt: string
          ethnicity: string | null
          experience: string | null
          gender: string | null
          languages: string | null
        }
        Insert: {
          id: string
          userId: string
          headshotUrl?: string | null
          bio?: string | null
          height?: string | null
          weight?: string | null
          hairColor?: string | null
          eyeColor?: string | null
          availability?: boolean
          createdAt?: string
          updatedAt?: string
          ethnicity?: string | null
          experience?: string | null
          gender?: string | null
          languages?: string | null
        }
        Update: {
          id?: string
          userId?: string
          headshotUrl?: string | null
          bio?: string | null
          height?: string | null
          weight?: string | null
          hairColor?: string | null
          eyeColor?: string | null
          availability?: boolean
          createdAt?: string
          updatedAt?: string
          ethnicity?: string | null
          experience?: string | null
          gender?: string | null
          languages?: string | null
        }
      }
      Studio: {
        Row: {
          id: string
          name: string
          description: string | null
          logo: string | null
          website: string | null
          userId: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          logo?: string | null
          website?: string | null
          userId: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          logo?: string | null
          website?: string | null
          userId?: string
          createdAt?: string
          updatedAt?: string
        }
      }
      Tenant: {
        Row: {
          id: string
          tenantType: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id: string
          tenantType: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          tenantType?: string
          createdAt?: string
          updatedAt?: string
        }
      }
      Project: {
        Row: {
          id: string
          title: string
          description: string | null
          startDate: string | null
          endDate: string | null
          status: string
          studioId: string
          isArchived: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id: string
          title: string
          description?: string | null
          startDate?: string | null
          endDate?: string | null
          status?: string
          studioId: string
          isArchived?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          startDate?: string | null
          endDate?: string | null
          status?: string
          studioId?: string
          isArchived?: boolean
          createdAt?: string
          updatedAt?: string
        }
      }
      CastingCall: {
        Row: {
          id: string
          title: string
          description: string
          requirements: string | null
          compensation: string | null
          startDate: string | null
          endDate: string | null
          status: string
          studioId: string
          locationId: string | null
          projectId: string | null
          regionId: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id: string
          title: string
          description: string
          requirements?: string | null
          compensation?: string | null
          startDate?: string | null
          endDate?: string | null
          status?: string
          studioId: string
          locationId?: string | null
          projectId?: string | null
          regionId?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          requirements?: string | null
          compensation?: string | null
          startDate?: string | null
          endDate?: string | null
          status?: string
          studioId?: string
          locationId?: string | null
          projectId?: string | null
          regionId?: string | null
          createdAt?: string
          updatedAt?: string
        }
      }
      Application: {
        Row: {
          id: string
          status: string
          message: string | null
          profileId: string
          castingCallId: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id: string
          status?: string
          message?: string | null
          profileId: string
          castingCallId: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          status?: string
          message?: string | null
          profileId?: string
          castingCallId?: string
          createdAt?: string
          updatedAt?: string
        }
      }
      Message: {
        Row: {
          id: string
          content: string
          subject: string
          isRead: boolean
          isArchived: boolean
          studioSenderId: string | null
          talentReceiverId: string | null
          talentSenderId: string | null
          studioReceiverId: string | null
          relatedToProjectId: string | null
          relatedToCastingCallId: string | null
          createdAt: string
        }
        Insert: {
          id: string
          content: string
          subject?: string
          isRead?: boolean
          isArchived?: boolean
          studioSenderId?: string | null
          talentReceiverId?: string | null
          talentSenderId?: string | null
          studioReceiverId?: string | null
          relatedToProjectId?: string | null
          relatedToCastingCallId?: string | null
          createdAt?: string
        }
        Update: {
          id?: string
          content?: string
          subject?: string
          isRead?: boolean
          isArchived?: boolean
          studioSenderId?: string | null
          talentReceiverId?: string | null
          talentSenderId?: string | null
          studioReceiverId?: string | null
          relatedToProjectId?: string | null
          relatedToCastingCallId?: string | null
          createdAt?: string
        }
      }
      // Add more tables as needed...
      // For brevity, I'm showing key tables
      // You can generate the rest using: npx supabase gen types typescript
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      UserRole: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
      SubscriptionStatus: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'PAST_DUE'
    }
  }
}
