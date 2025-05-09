import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import pool from '@/utils/db';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export async function POST(req: Request) {
  const client = await pool.connect();
  
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

    // Check if user already exists
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

    // Start transaction
    await client.query('BEGIN');

    try {
      // First, create user in Prisma
      console.log('Creating new user with face descriptor length:', faceData.length);
      const prismaUser = await prisma.user.create({
        data: {
          name,
          email,
          faceData: JSON.stringify(faceData)
        }
      });

      // Then, insert directly into PostgreSQL
      const query = `
        INSERT INTO users (id, name, email, face_data, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await client.query(query, [
        prismaUser.id,
        name,
        email,
        JSON.stringify(faceData),
        new Date().toISOString()
      ]);

      // Commit transaction
      await client.query('COMMIT');

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
      // Rollback transaction on error
      await client.query('ROLLBACK');
      throw error;
    }
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
    client.release();
  }
}