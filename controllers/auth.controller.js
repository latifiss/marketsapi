import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import { generateToken, generateApiKey } from '../middleware/auth.js';

export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        code: 400,
        message: 'User already exists',
      });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const apiKey = generateApiKey();

    const user = new User({
      email,
      password: hashedPassword,
      name,
      apiKey: apiKey,
    });

    await user.save();
    const token = generateToken({
      userId: String(user._id),
      email: user.email,
    });

    res.status(201).json({
      success: true,
      code: 201,
      message: 'User created successfully',
      token,
      apiKey,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error',
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid credentials',
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        code: 401,
        message: 'Invalid credentials',
      });
      return;
    }

    const token = generateToken({
      userId: String(user._id),
      email: user.email,
    });

    res.json({
      success: true,
      code: 200,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        apiKey: user.apiKey,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error',
    });
  }
};

export const generateNewApiKey = async (req, res) => {
  try {
    const userId = req.user.userId;
    const apiKey = generateApiKey();

    await User.findByIdAndUpdate(userId, {
      apiKey,
      apiKeyGeneratedAt: new Date(),
    });

    res.json({
      success: true,
      code: 200,
      message: 'API key generated successfully',
      apiKey,
      generatedAt: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error',
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      res.status(404).json({
        success: false,
        code: 404,
        message: 'User not found',
      });
      return;
    }
    res.json({
      success: true,
      code: 200,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        apiKey: user.apiKey,
        apiKeyGeneratedAt: user.apiKeyGeneratedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 500,
      message: 'Internal server error',
    });
  }
};
