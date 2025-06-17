import React, { ReactNode } from 'react'
import { Box, Text } from 'ink'

interface LayoutProps {
  children: ReactNode
  header?: ReactNode
  footer?: ReactNode
}

export function Layout({ children, header, footer }: LayoutProps) {
  return (
    <Box flexDirection="column" height="100%">
      {header && (
        <Box key="header">
          {header}
        </Box>
      )}
      
      <Box key="main" flexGrow={1} flexDirection="column">
        {children}
      </Box>
      
      {footer && (
        <Box key="footer">
          {footer}
        </Box>
      )}
    </Box>
  )
}

export function Header() {
  return (
    <Box flexDirection="column">
      <Box key="title" justifyContent="center" paddingY={1}>
        <Text bold color="cyan">◍ OpenCode</Text>
        <Text color="gray" dimColor> - AI Coding Assistant</Text>
      </Box>
      <Box key="separator">
        <Text color="gray">─────────────────────────────────────────────────────────</Text>
      </Box>
    </Box>
  )
}

export function StatusBar({ status, session }: { status: string; session?: string }) {
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text key="status" color="green">● {status}</Text>
      {session && <Text key="session" color="blue">Session: {session.slice(-8)}</Text>}
    </Box>
  )
}

export default Layout 