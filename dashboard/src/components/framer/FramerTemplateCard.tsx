/**
 * Example Framer Component Integration
 * This shows how to adapt a Framer export to work with your existing system
 */

import React from 'react';
import { motion } from 'framer-motion';
import { UnifiedTemplate } from '@/types/unified-template';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FramerTemplateCardProps {
  template: UnifiedTemplate;
  onClick?: () => void;
  className?: string;
}

// This would be the component exported from Framer
export function FramerTemplateCard({ template, onClick, className }: FramerTemplateCardProps) {
  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white shadow-lg cursor-pointer",
        className
      )}
      whileHover={{ 
        scale: 1.02,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)"
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onClick}
    >
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 opacity-10"
        animate={{
          background: [
            "linear-gradient(to bottom right, #a78bfa, #f472b6)",
            "linear-gradient(to bottom right, #f472b6, #a78bfa)",
            "linear-gradient(to bottom right, #a78bfa, #f472b6)",
          ],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />
      
      {/* Content */}
      <div className="relative p-6 space-y-4">
        {/* Icon with animation */}
        <motion.div
          className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white"
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6 }}
        >
          {template.type === 'smart' && '⚡'}
          {template.type === 'workflow' && '🔄'}
          {template.type === 'standard' && '📄'}
        </motion.div>
        
        {/* Title and description */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
            {template.description}
          </p>
        </div>
        
        {/* Tags with stagger animation */}
        <motion.div 
          className="flex flex-wrap gap-2"
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.05
              }
            }
          }}
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <Badge variant="secondary">{template.category}</Badge>
          </motion.div>
          
          {template.tags?.slice(0, 2).map((tag, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <Badge variant="outline" className="text-xs">
                {tag}
              </Badge>
            </motion.div>
          ))}
        </motion.div>
        
        {/* Usage count with animated counter */}
        {template.usage_count !== undefined && (
          <motion.div 
            className="text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", delay: 0.4 }}
            >
              {template.usage_count}
            </motion.span>
            {' uses'}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}