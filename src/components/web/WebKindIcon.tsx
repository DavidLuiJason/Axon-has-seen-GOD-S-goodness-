/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Ghost, Globe, VenetianMask } from 'lucide-react';
import type { WebTabKind } from '../../web/ui/webUiTypes';

interface WebKindIconProps {
  kind: WebTabKind;
  size?: number;
  className?: string;
}

export const WebKindIcon: React.FC<WebKindIconProps> = ({
  kind,
  size = 14,
  className,
}) => {
  switch (kind) {
    case 'normal':
      return <Globe size={size} className={className} />;
    case 'incognito':
      return <VenetianMask size={size} className={className} />;
    case 'stealth':
      return <Ghost size={size} className={className} />;
  }
};
