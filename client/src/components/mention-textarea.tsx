import { useState, useRef, useEffect, forwardRef, KeyboardEvent, ChangeEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MentionUser {
  id: string;
  name: string;
  color?: string | null;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea(
    {
      value,
      onChange,
      users,
      placeholder,
      className,
      disabled,
      "data-testid": testId,
    },
    forwardedRef
  ) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredUsers, setFilteredUsers] = useState<MentionUser[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState(-1);
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const textareaRef = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart || 0;
      
      onChange(newValue);
      
      const textBeforeCursor = newValue.substring(0, cursorPos);
      const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtSymbol !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
        const hasSpaceOrNewline = /\s/.test(textAfterAt) && textAfterAt.trim().includes(' ');
        
        if (!hasSpaceOrNewline || textAfterAt.length <= 20) {
          const searchTerm = textAfterAt.toLowerCase();
          const matches = users.filter(user => 
            user.name.toLowerCase().includes(searchTerm) ||
            user.name.toLowerCase().split(' ')[0].includes(searchTerm)
          ).slice(0, 5);
          
          if (matches.length > 0) {
            setFilteredUsers(matches);
            setShowSuggestions(true);
            setMentionStart(lastAtSymbol);
            setSelectedIndex(0);
            return;
          }
        }
      }
      
      setShowSuggestions(false);
      setMentionStart(-1);
    };

    const insertMention = (user: MentionUser) => {
      if (mentionStart === -1) return;
      
      const currentRef = textareaRef.current || internalRef.current;
      const beforeMention = value.substring(0, mentionStart);
      const afterCursor = value.substring(currentRef?.selectionStart || value.length);
      const textAfterMention = afterCursor.replace(/^[^\s]*/, '');
      
      const newValue = `${beforeMention}@${user.name} ${textAfterMention}`;
      onChange(newValue);
      
      setShowSuggestions(false);
      setMentionStart(-1);
      
      setTimeout(() => {
        const ref = textareaRef.current || internalRef.current;
        if (ref) {
          const newPos = beforeMention.length + user.name.length + 2;
          ref.selectionStart = newPos;
          ref.selectionEnd = newPos;
          ref.focus();
        }
      }, 0);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredUsers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredUsers[selectedIndex]) {
          e.preventDefault();
          insertMention(filteredUsers[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    };

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
          setShowSuggestions(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="relative">
        <Textarea
          ref={forwardedRef || internalRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          data-testid={testId}
        />
        
        {showSuggestions && filteredUsers.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 mt-1 w-64 bg-popover border rounded-md shadow-lg overflow-hidden"
            data-testid="mention-suggestions"
          >
            {filteredUsers.map((user, index) => (
              <button
                key={user.id}
                type="button"
                onClick={() => insertMention(user)}
                data-testid={`button-mention-${user.id}`}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                )}
              >
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                  style={{ backgroundColor: user.color || '#6366f1' }}
                >
                  {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="truncate">{user.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
