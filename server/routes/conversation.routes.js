const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const createMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
});

const createConversationSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
});

/**
 * GET /conversations
 * Get all conversations for the authenticated user (couple or vendor)
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userRole = req.user.role;

    let conversations;

    if (userRole === 'couple') {
      // Get conversations where user is the couple
      conversations = await prisma.conversation.findMany({
        where: { coupleId: userId },
        include: {
          vendor: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profilePicture: true,
                },
              },
            },
          },
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1, // Get only the last message
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else if (userRole === 'vendor') {
      // Get conversations where user is the vendor
      conversations = await prisma.conversation.findMany({
        where: { vendorId: userId },
        include: {
          couple: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profilePicture: true,
                },
              },
            },
          },
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1, // Get only the last message
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else {
      return res.status(403).json({ error: 'Invalid user role' });
    }

    // Transform conversations to include participant info and unread count
    const transformedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const participant =
          userRole === 'couple'
            ? {
                id: conv.vendor.userId,
                name: conv.vendor.user.name || 'Vendor',
                email: conv.vendor.user.email,
                profilePicture: conv.vendor.user.profilePicture,
                type: 'vendor',
              }
            : {
                id: conv.couple.userId,
                name: conv.couple.user.name || 'Couple',
                email: conv.couple.user.email,
                profilePicture: conv.couple.user.profilePicture,
                type: 'couple',
              };

        // Count unread messages (messages sent by the other party after last read time)
        const lastReadAt = userRole === 'couple' ? conv.coupleLastReadAt : conv.vendorLastReadAt;
        
        // If never read, use conversation creation time
        const readThreshold = lastReadAt || conv.createdAt;

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            timestamp: { gt: readThreshold },
          },
        });

        const lastMessage = conv.messages[0] || null;

        return {
          id: conv.id,
          participant,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                timestamp: lastMessage.timestamp,
                senderId: lastMessage.senderId,
                senderName: lastMessage.sender.name || 'Unknown',
              }
            : null,
          unreadCount,
          updatedAt: conv.updatedAt,
        };
      })
    );

    res.json(transformedConversations);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /conversations/:conversationId/messages
 * Get all messages in a conversation
 */
router.get('/:conversationId/messages', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { conversationId } = req.params;

    // Verify user has access to this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.coupleId !== userId && conversation.vendorId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Mark conversation as read for the current user
    const userRole = req.user.role;
    const updateData = {};
    if (userRole === 'couple') {
      updateData.coupleLastReadAt = new Date();
    } else if (userRole === 'vendor') {
      updateData.vendorLastReadAt = new Date();
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: updateData,
      });

      // Note: We don't emit WebSocket event here because:
      // 1. The frontend will refresh conversations after fetching messages
      // 2. The Navbar listens to 'conversation-read' custom event
      // 3. This avoids excessive WebSocket events that cause performance issues
    }

    res.json(messages);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /conversations/:conversationId/messages
 * Send a message in a conversation
 */
router.post('/:conversationId/messages', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { conversationId } = req.params;
    const { content } = createMessageSchema.parse(req.body);

    // Verify user has access to this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.coupleId !== userId && conversation.vendorId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update conversation's updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Emit WebSocket event to conversation participants
    const io = req.app.get('io');
    const emitNewMessage = req.app.get('emitNewMessage');
    const notifyNewMessage = req.app.get('notifyNewMessage');

    if (io && emitNewMessage) {
      // Include conversationId in message for client
      const messageWithConversationId = {
        ...message,
        conversationId: conversationId,
      };
      // Emit to all participants in the conversation room (including sender for instant update)
      emitNewMessage(conversationId, messageWithConversationId);
      
      // Also notify the other participant specifically (for unread badges)
      const otherUserId = conversation.coupleId === userId ? conversation.vendorId : conversation.coupleId;
      notifyNewMessage(otherUserId, conversationId, messageWithConversationId);
    }

    res.status(201).json(message);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

/**
 * POST /conversations
 * Create or get existing conversation with a vendor (couple only)
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userRole = req.user.role;

    if (userRole !== 'couple') {
      return res.status(403).json({ error: 'Only couples can initiate conversations' });
    }

    const { vendorId } = createConversationSchema.parse(req.body);

    // Check if vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { userId: vendorId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findUnique({
      where: {
        coupleId_vendorId: {
          coupleId: userId,
          vendorId: vendorId,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          coupleId: userId,
          vendorId: vendorId,
        },
      });
    }

    // Return conversation with participant info
    const fullConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: {
        vendor: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    const conversationData = {
      id: fullConversation.id,
      participant: {
        id: fullConversation.vendor.userId,
        name: fullConversation.vendor.user.name || 'Vendor',
        email: fullConversation.vendor.user.email,
        profilePicture: fullConversation.vendor.user.profilePicture,
        type: 'vendor',
      },
      createdAt: fullConversation.createdAt,
      updatedAt: fullConversation.updatedAt,
    };

    // Emit WebSocket event for new conversation
    const io = req.app.get('io');
    const emitConversationUpdate = req.app.get('emitConversationUpdate');
    if (io && emitConversationUpdate) {
      emitConversationUpdate(userId, conversationData);
    }

    res.json(conversationData);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => ({ field: i.path?.[0] ?? 'unknown', message: i.message }));
      return res.status(400).json({ error: issues[0]?.message || 'Invalid input', issues });
    }
    next(err);
  }
});

/**
 * GET /conversations/unread-count
 * Get total unread message count for the authenticated user
 */
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const userRole = req.user.role;

    let conversations;

    if (userRole === 'couple') {
      conversations = await prisma.conversation.findMany({
        where: { coupleId: userId },
      });
    } else if (userRole === 'vendor') {
      conversations = await prisma.conversation.findMany({
        where: { vendorId: userId },
      });
    } else {
      return res.status(403).json({ error: 'Invalid user role' });
    }

    let totalUnread = 0;

    for (const conv of conversations) {
      // Count unread messages (messages sent by the other party after last read time)
      const lastReadAt = userRole === 'couple' ? conv.coupleLastReadAt : conv.vendorLastReadAt;
      
      // If never read, use conversation creation time
      const readThreshold = lastReadAt || conv.createdAt;

      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: userId },
          timestamp: { gt: readThreshold },
        },
      });

      totalUnread += unreadCount;
    }

    res.json({ unreadCount: totalUnread });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


