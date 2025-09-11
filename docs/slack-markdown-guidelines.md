# Slack Block Kit Markdown Formatting Guidelines

This document outlines the proper markdown formatting standards for Slack Block Kit components in the Daily Dose bot.

## Formatting Standards

### 1. Bold Text
- Use `*text*` for bold formatting
- Example: `*Daily Standup*` → **Daily Standup**

### 2. Italic Text
- Use `_text_` for italic formatting
- Example: `_italic text_` → *italic text*

### 3. Strikethrough
- Use `~text~` for strikethrough formatting
- Example: `~strikethrough~` → ~~strikethrough~~

### 4. Inline Code
- Use backticks for inline code
- Example: `` `const x = 1;` `` → `const x = 1;`

### 5. Code Blocks
- Use triple backticks for code blocks
```
```
function hello() {
  return "world";
}
```
```

### 6. Block Quotes
- Use `>` for block quotes
- Example:
```
> This is a quote
> Second line
```

### 7. Lists
- **Bulleted lists**: Use `•` (bullet character)
  ```
  • Item A
  • Item B
  ```
- **Numbered lists**: Use standard numbering
  ```
  1. First item
  2. Second item
  ```

### 8. Links
- Use `<URL|text>` format
- Example: `<https://slack.com|Slack website>`

### 9. Mentions
- **Users**: `<@U12345678>` or `<@USERID>`
- **Channels**: `<#C12345678>` or `<#CHANNELID>`
- **User groups**: `<!subteam^S12345678>`

### 10. Line Breaks
- Use `\n` for line breaks in mrkdwn text
- Example: `First line\nSecond line`

### 11. Escaping Characters
- Use backslash to escape special characters
- Example: `\*not bold\*` → *not bold*

## Block Structure Examples

### Complete Formatting Example Block
```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "Slack Markdown Examples",
        "emoji": true
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*1. Bold* → *bold*\n*2. Italic* → _italic_\n*3. Strikethrough* → ~strikethrough~"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*4. Inline code* → `const x = 1;`\n*5. Code block* → \n```\nfunction hello() {\n  return \"world\";\n}\n```"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*6. Block quote* →\n> This is a quote\n> Second line"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*7. Lists:*\n• Bulleted item A\n• Bulleted item B\n\n1. Numbered one\n2. Numbered two"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*8. Links* → <https://slack.com|Slack website>"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*9. Mentions* → <@U12345678> (user), <#C12345678> (channel), <!subteam^S12345678> (user group)"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*10. Line break* → First line\\nSecond line"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*11. Escaping characters* → \\*not bold\\*"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "_End of examples_"
        }
      ]
    }
  ]
}
```

## Daily Dose Specific Guidelines

### Standup Messages
- Use consistent emoji prefixes:
  - `📊` for standup headers
  - `👤` for user mentions
  - `📄` for yesterday's tasks
  - `🎯` for today's tasks
  - `⚠️` for blockers
  - `🌴` for on leave
  - `📝` for not responded
  - `🕐` for late submissions

### Team Information
- Use `👥` for member counts
- Use `👑` for admin roles
- Use `📅` for dates
- Use `🔔` for notifications/reminders

### Status Messages
- Use `✅` for success messages
- Use `❌` for error messages
- Use `⚠️` for warnings
- Use `📋` for lists/information

### Lists in Blocks
- Always use bullet character `•` for bulleted lists
- Use proper spacing with `\n` for line breaks
- Format team member lists consistently:
  ```
  👑 <@U123> (Display Name) - admin
  👤 <@U456> (Display Name) - member
  ```

## Best Practices

1. **Consistency**: Always use the same emoji and formatting patterns
2. **Readability**: Use proper line breaks and spacing
3. **User Experience**: Make mentions and links clearly identifiable
4. **Accessibility**: Use descriptive text with emojis, not emojis alone
5. **Escaping**: Properly escape special characters when they should be literal

## Common Mistakes to Avoid

1. Using `*` inside text that should be literal (escape with `\*`)
2. Inconsistent bullet characters (use `•` not `-` or `*`)
3. Missing line breaks between sections
4. Inconsistent emoji usage
5. Not escaping user input that might contain markdown characters

---

*Last updated: Generated with Claude Code*