/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  Bookmark,
  BookOpen,
  Globe,
  Layers,
  MessageSquare,
  Monitor,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  Smartphone,
} from 'lucide-react';
import type { QuickActionId } from './types';

interface QuickActionIconProps {
  id: QuickActionId | 'customize';
  size?: number;
  className?: string;
}

export const QuickActionIcon: React.FC<QuickActionIconProps> = ({
  id,
  size = 14,
  className,
}) => {
  switch (id) {
    case 'none':
      return <Ban size={size} className={className} />;
    case 'toggle-chat-web':
      return <ArrowLeftRight size={size} className={className} />;
    case 'switch-chat':
      return <MessageSquare size={size} className={className} />;
    case 'switch-web':
      return <Globe size={size} className={className} />;
    case 'switch-apps':
      return <Smartphone size={size} className={className} />;
    case 'new-chat':
      return <Plus size={size} className={className} />;
    case 'scroll-latest':
      return <ArrowDown size={size} className={className} />;
    case 'new-tab':
      return <Plus size={size} className={className} />;
    case 'tab-switcher':
      return <Layers size={size} className={className} />;
    case 'refresh':
      return <RotateCcw size={size} className={className} />;
    case 'back':
      return <ArrowLeft size={size} className={className} />;
    case 'find-in-page':
      return <Search size={size} className={className} />;
    case 'reader-mode':
      return <BookOpen size={size} className={className} />;
    case 'desktop-site':
      return <Monitor size={size} className={className} />;
    case 'bookmark-page':
      return <Bookmark size={size} className={className} />;
    case 'pane-view':
      return <Layers size={size} className={className} />;
    case 'customize':
      return <Sliders size={size} className={className} />;
  }
};
