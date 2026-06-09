import { createTheme } from '@mui/material/styles';

// Dynamically reads CSS custom properties set by our design tokens.
// Kept in sync with the SCSS token system (frontend/app/globals.scss).
const getToken = (name) => {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

export function buildMuiTheme(mode = 'light') {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main:        isDark ? '#818CF8' : '#6366F1',
        dark:        isDark ? '#A5B4FC' : '#4F46E5',
        light:       isDark ? '#C7D2FE' : '#818CF8',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main:        isDark ? '#C084FC' : '#8B5CF6',
        contrastText: '#FFFFFF',
      },
      success: {
        main:        isDark ? '#34D399' : '#059669',
        contrastText: '#FFFFFF',
      },
      error: {
        main:        isDark ? '#F87171' : '#DC2626',
        contrastText: '#FFFFFF',
      },
      warning: {
        main:        isDark ? '#FBBF24' : '#D97706',
        contrastText: '#FFFFFF',
      },
      background: {
        default: isDark ? '#0B0B0E' : '#FAFAF9',
        paper:   isDark ? '#141417' : '#FFFFFF',
      },
      text: {
        primary:   isDark ? '#FAFAFA' : '#18181B',
        secondary: isDark ? '#B7B7C0' : '#52525B',
        disabled:  isDark ? '#52525B' : '#A1A1AA',
      },
      divider: isDark ? '#26262B' : '#ECECEA',
    },

    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontWeightLight:   400,
      fontWeightRegular: 400,
      fontWeightMedium:  500,
      fontWeightBold:    600,
      h1: { fontWeight: 800, letterSpacing: '-0.04em' },
      h2: { fontWeight: 700, letterSpacing: '-0.03em' },
      h3: { fontWeight: 700, letterSpacing: '-0.025em' },
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      button: { fontWeight: 500, letterSpacing: '-0.01em', textTransform: 'none' },
      body1: { fontSize: '0.875rem' },   // 14px
      body2: { fontSize: '0.8125rem' },  // 13px
      caption: { fontSize: '0.6875rem' }, // 11px
    },

    shape: { borderRadius: 12 },

    shadows: isDark
      ? [
          'none',
          '0 1px 2px rgba(0,0,0,0.50)',
          '0 2px 8px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.40)',
          '0 4px 16px rgba(0,0,0,0.65), 0 2px 6px rgba(0,0,0,0.45)',
          '0 10px 30px rgba(0,0,0,0.75), 0 4px 10px rgba(0,0,0,0.55)',
          '0 20px 40px rgba(0,0,0,0.82), 0 8px 16px rgba(0,0,0,0.60)',
          '0 28px 64px rgba(0,0,0,0.92), 0 8px 24px rgba(0,0,0,0.72)',
          ...Array(18).fill('0 28px 64px rgba(0,0,0,0.92)'),
        ]
      : [
          'none',
          '0 1px 2px rgba(24,24,27,0.04)',
          '0 1px 3px rgba(24,24,27,0.06), 0 1px 2px rgba(24,24,27,0.04)',
          '0 6px 12px -2px rgba(24,24,27,0.06), 0 3px 6px -3px rgba(24,24,27,0.05)',
          '0 12px 22px -4px rgba(24,24,27,0.08), 0 6px 10px -6px rgba(24,24,27,0.05)',
          '0 24px 34px -8px rgba(24,24,27,0.10), 0 10px 14px -8px rgba(24,24,27,0.05)',
          '0 28px 56px -16px rgba(24,24,27,0.18), 0 0 0 1px rgba(24,24,27,0.04)',
          ...Array(18).fill('0 28px 56px -16px rgba(24,24,27,0.18)'),
        ],

    transitions: {
      duration: {
        shortest: 120,
        shorter:  160,
        short:    200,
        standard: 200,
        complex:  350,
        enteringScreen: 200,
        leavingScreen:  160,
      },
      easing: {
        easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        easeOut:   'cubic-bezier(0.0, 0, 0.2, 1)',
        easeIn:    'cubic-bezier(0.4, 0, 1, 1)',
        sharp:     'cubic-bezier(0.4, 0, 0.6, 1)',
      },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { fontFamily: "'Inter', sans-serif" } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 12,
            textTransform: 'none',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            minHeight: 44,
            transition: 'background 120ms, box-shadow 120ms, transform 120ms, border-color 120ms',
            '&:active': { transform: 'scale(0.98)' },
          },
          contained: {
            boxShadow: '0 1px 3px rgba(99,102,241,0.28)',
            '&:hover': { boxShadow: '0 4px 12px rgba(99,102,241,0.32)', transform: 'translateY(-1px)' },
          },
          outlined: {
            borderColor: isDark ? '#303036' : '#D8D8D4',
            '&:hover': { borderColor: isDark ? '#45454D' : '#ABABA4' },
          },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              fontSize: '1rem', // 16px — never triggers iOS focus-zoom
              '& fieldset': { borderColor: isDark ? '#303036' : '#D8D8D4', transition: 'border-color 120ms, box-shadow 120ms' },
              '&:hover fieldset': { borderColor: isDark ? '#45454D' : '#ABABA4' },
              '&.Mui-focused fieldset': {
                borderColor: isDark ? '#818CF8' : '#6366F1',
                boxShadow: `0 0 0 3px ${isDark ? 'rgba(129,140,248,0.20)' : 'rgba(99,102,241,0.18)'}`,
              },
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 2 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: 16 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 9999, fontWeight: 600, fontSize: '0.6875rem', height: 24 },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: {
          tooltip: {
            borderRadius: 10,
            fontSize: '0.75rem',
            fontWeight: 500,
            background: isDark ? '#222227' : '#18181B',
            padding: '6px 10px',
          },
          arrow: { color: isDark ? '#222227' : '#18181B' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            fontSize: '0.8125rem',
            borderBottom: `1px solid ${isDark ? '#26262B' : '#ECECEA'}`,
            padding: '10px 16px',
          },
          head: {
            fontWeight: 600,
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isDark ? '#8A8A95' : '#71717A',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background 120ms',
            '&:hover': { background: isDark ? 'rgba(129,140,248,0.07)' : 'rgba(99,102,241,0.05)' },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 22,
            boxShadow: isDark
              ? '0 28px 64px rgba(0,0,0,0.92), 0 8px 24px rgba(0,0,0,0.72)'
              : '0 28px 56px -16px rgba(24,24,27,0.18), 0 0 0 1px rgba(24,24,27,0.04)',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            transition: 'background 120ms, color 120ms',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: isDark ? '#26262B' : '#ECECEA' },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${isDark ? '#303036' : '#D8D8D4'}`,
            boxShadow: isDark
              ? '0 28px 64px rgba(0,0,0,0.92)'
              : '0 28px 56px -16px rgba(24,24,27,0.18)',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '0.8125rem',
            fontWeight: 500,
            borderRadius: 10,
            margin: '2px 6px',
            transition: 'background 120ms',
            '&:hover': { background: isDark ? 'rgba(129,140,248,0.08)' : 'rgba(99,102,241,0.06)' },
          },
        },
      },
    },
  });
}
