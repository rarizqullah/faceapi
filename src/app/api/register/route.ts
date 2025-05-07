import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

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

    console.log('Checking for existing user with email:', email);
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    }).catch(error => {
      console.error('Error checking for existing user:', error);
      throw error;
    });

    if (existingUser) {
      console.log('User already exists with email:', email);
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    console.log('Creating new user...');
    // Store user with face features
    const user = await prisma.user.create({
      data: {
        name,
        email,
        faceData: JSON.stringify(faceData)
      }
    }).catch(error => {
      console.error('Error creating user:', error);
      throw error;
    });

    console.log('User created successfully:', user.id);
    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
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