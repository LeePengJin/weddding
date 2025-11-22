import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Various shades of rose/pink for the petals
const COLORS = ['#fda4af', '#fb7185', '#f43f5e', '#FECDD3', '#ffe4e6']; 

export const PetalCursor = () => {
  const [petals, setPetals] = useState([]);

  useEffect(() => {
    let lastTime = 0;
    
    const handleMouseMove = (e) => {
      const now = Date.now();
      // Throttle creation: one petal every 50ms
      if (now - lastTime > 50) {
        const newPetal = {
          id: now,
          x: e.clientX,
          y: e.clientY,
          rotation: Math.random() * 360,
          size: Math.random() * 12 + 8, // Random size between 8px and 20px
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        };
        
        setPetals(prev => [...prev, newPetal]);
        lastTime = now;

        // Cleanup old petals to keep performance high
        if (petals.length > 50) {
            setPetals(prev => prev.slice(1)); 
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [petals.length]);

  // Auto cleanup interval
  useEffect(() => {
    const interval = setInterval(() => {
       const now = Date.now();
       // Remove petals older than 2 seconds
       setPetals(prev => prev.filter(p => now - p.id < 2000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 100,
      overflow: 'hidden',
    }}>
      <AnimatePresence>
        {petals.map(petal => (
          <motion.div
            key={petal.id}
            initial={{ 
                opacity: 0.8, 
                x: petal.x, 
                y: petal.y, 
                rotate: petal.rotation, 
                scale: 0 
            }}
            animate={{
              opacity: 0,
              y: petal.y + 150 + Math.random() * 100, // Fall down
              x: petal.x + (Math.random() - 0.5) * 100, // Sway left/right
              rotate: petal.rotation + 180 + (Math.random() - 0.5) * 90, // Spin
              scale: 1
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              position: 'absolute',
              borderRadius: '100% 0% 0% 100%', // CSS shape for a petal/leaf (rounded top-right, rounded bottom-left)
              width: petal.size,
              height: petal.size,
              backgroundColor: petal.color,
              boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
              transformOrigin: 'center',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
