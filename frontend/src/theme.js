import { createTheme } from '@mui/material/styles';

// Dynamically reads CSS custom properties set by Meridian 2.0 design tokens.
// This keeps MUI in sync with our SCSS token system at runtime.
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
        main:        isDark ? '#818CF8' : '#4F46E5',
        dark:        isDark ? '#A5B4FC' : '#4338CA',
        light:       isDark ? '#C7D2FE' : '#818CF8',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main:        isDark ? '#C084FC' : '#7C3AED',
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
        default: isDark ? '#080818' : '#F5F6FA',
        paper:   isDark ? '#0E0E24' : '#FFFFFF',
      },
      text: {
        primary:   isDark ? '#EEEEFF' : '#09091E',
        secondary: isDark ? '#B8BCD8' : '#3B4068',
        disabled:  isDark ? '#3F4264' : '#A5AACB',
      },
      divider: isDark ? '#1C1C38' : '#E3E5F0',
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

    shape: { borderRadius: 10 },

    shadows: [
      'none',
      '0 1px 2px rgba(0,0,0,0.05)',
      '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
      '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.04)',
      '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)',
      '0 20px 25px -5px rgba(0,0,0,0.09), 0 8px 10px -6px rgba(0,0,0,0.04)',
      '0 24px 48px -12px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)',
      ...Array(18).fill('0 24px 48px -12px rgba(0,0,0,0.16)'),
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
            borderRadius: 10,
            textTransform: 'none',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            transition: 'background 120ms, box-shadow 120ms, transform 120ms, border-color 120ms',
            '&:active': { transform: 'scale(0.98)' },
          },
          contained: {
            boxShadow: '0 1px 3px rgba(79, 70, 229, 0.28)',
            '&:hover': { boxShadow: '0 4px 12px rgba(79, 70, 229, 0.32)', transform: 'translateY(-1px)' },
          },
          outlined: {
            borderColor: isDark ? '#272748' : '#C9CCDF',
            '&:hover': { borderColor: isDark ? '#383860' : '#9096BE' },
          },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              fontSize: '0.8125rem',
              '& fieldset': { borderColor: isDark ? '#272748' : '#C9CCDF', transition: 'border-color 120ms, box-shadow 120ms' },
              '&:hover fieldset': { borderColor: isDark ? '#383860' : '#9096BE' },
              '&.Mui-focused fieldset': {
                borderColor: isDark ? '#818CF8' : '#4F46E5',
                boxShadow: `0 0 0 3px ${isDark ? 'rgba(129,140,248,0.20)' : 'rgba(79,70,229,0.18)'}`,
              },
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 2 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: 14 },
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
            borderRadius: 8,
            fontSize: '0.75rem',
            fontWeight: 500,
            background: isDark ? '#1A1A38' : '#09091E',
            padding: '6px 10px',
          },
          arrow: { color: isDark ? '#1A1A38' : '#09091E' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            fontSize: '0.8125rem',
            borderBottom: `1px solid ${isDark ? '#1C1C38' : '#E3E5F0'}`,
            padding: '10px 16px',
          },
          head: {
            fontWeight: 600,
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isDark ? '#6D7098' : '#686D96',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background 120ms',
            '&:hover': { background: isDark ? 'rgba(129,140,248,0.06)' : 'rgba(79,70,229,0.05)' },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            boxShadow: isDark
              ? '0 28px 64px rgba(0,0,0,0.92), 0 8px 24px rgba(0,0,0,0.72)'
              : '0 24px 48px -12px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.04)',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'background 120ms, color 120ms',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: isDark ? '#1C1C38' : '#E3E5F0' },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: `1px solid ${isDark ? '#272748' : '#C9CCDF'}`,
            boxShadow: isDark
              ? '0 28px 64px rgba(0,0,0,0.92)'
              : '0 24px 48px -12px rgba(0,0,0,0.16)',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '0.8125rem',
            fontWeight: 500,
            borderRadius: 8,
            margin: '2px 6px',
            transition: 'background 120ms',
            '&:hover': { background: isDark ? 'rgba(129,140,248,0.08)' : 'rgba(79,70,229,0.06)' },
          },
        },
      },
    },
  });
}
