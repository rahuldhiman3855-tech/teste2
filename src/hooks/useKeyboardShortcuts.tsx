import { useEffect } from "react";

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const ctrlMatch = shortcut.ctrlKey === undefined || shortcut.ctrlKey === (event.ctrlKey || event.metaKey);
        const shiftMatch = shortcut.shiftKey === undefined || shortcut.shiftKey === event.shiftKey;
        const altMatch = shortcut.altKey === undefined || shortcut.altKey === event.altKey;
        const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
};

export const KEYBOARD_SHORTCUTS = [
  { key: "k", ctrlKey: true, description: "Focus message input" },
  { key: "b", ctrlKey: true, description: "Toggle sidebar" },
  { key: "d", ctrlKey: true, description: "Toggle dark/light mode" },
  { key: "n", ctrlKey: true, description: "New conversation" },
  { key: "?", ctrlKey: true, description: "Show keyboard shortcuts" },
  { key: "Escape", description: "Close dialogs" },
];