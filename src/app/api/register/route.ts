import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { supabase } from '@/utils/supabase';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export async function POST(req: Request) {
  try {
    console.log('Starting registration process...');
    const { name, email, faceData } = await req.json();

    // Validate input
    if (!name || !email || !faceData) {
      console.log('Missing required fields:', { name: !!name, email: !!email, faceData: !!faceData });
      return NextResponse.json(
        { error: 'Name, email, and face data are required' },
        { status: 400 }
      );
    }

    // Ensure faceData is a valid array that can be converted to Float32Array
    if (!Array.isArray(faceData) || faceData.length === 0) {
      return NextResponse.json(
        { error: 'Invalid face data format' },
        { status: 400 }
      );
    }

    console.log('Checking for existing user with email:', email);
    // Check if user already exists in Prisma
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('User already exists with email:', email);
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // First, create user in Prisma
    console.log('Creating new user with face descriptor length:', faceData.length);
    const prismaUser = await prisma.user.create({
      data: {
        name,
        email,
        faceData: JSON.stringify(faceData)
      }
    });

    // Then, store user data in Supabase
    const { data: supabaseUser, error: supabaseError } = await supabase
      .from('users')
      .insert([
        {
          id: prismaUser.id,
          name,
          email,
          face_data: faceData, // Supabase will automatically handle JSON serialization
          created_at: new Date().toISOString()
        }
      ]);

    if (supabaseError) {
      console.error('Error storing user in Supabase:', supabaseError);
      // Rollback Prisma creation if Supabase fails
      await prisma.user.delete({
        where: { id: prismaUser.id }
      });
      return NextResponse.json(
        { error: 'Failed to store user data' },
        { status: 500 }
      );
    }

    console.log('User created successfully:', prismaUser.id);
    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: prismaUser.id,
        name: prismaUser.name,
        email: prismaUser.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to register user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}