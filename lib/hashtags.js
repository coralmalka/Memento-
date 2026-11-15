import React from 'react';
import { Text } from 'react-native';

// Hashtags remain selectable text, while valid tags can open Memento search.
// All other characters (including emoji and newlines) remain unchanged.
export function HashtagText({ children, style, onHashtag, ...props }) {
  const content = typeof children === 'string' ? children : String(children ?? '');
  if (!content) return <Text style={style} {...props} />;
  const parts = content.split(/(#[\p{L}\p{N}_]+)/gu);
  return <Text style={style} {...props}>
    {parts.map((part, index) =>
      /^#[\p{L}\p{N}_]+$/u.test(part)
        ? <Text key={index} style={{ color: '#D92D32', fontWeight: '700' }}
            onPress={onHashtag ? () => onHashtag(part.slice(1)) : undefined}>{part}</Text>
        : part
    )}
  </Text>;
}
