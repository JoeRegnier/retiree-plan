import type { Theme } from '@mui/material/styles';
import type { TypographyProps } from '@mui/material/Typography';
import type { InputBaseProps } from '@mui/material/InputBase';
import type { InputLabelProps } from '@mui/material/InputLabel';
import type { SelectProps } from '@mui/material/Select';
import type { DialogProps } from '@mui/material/Dialog';
import type { PaperProps } from '@mui/material/Paper';
import type { ResponsiveStyleValue, SystemProps } from '@mui/system';
import type * as React from 'react';

interface LegacyStyleProps {
  alignItems?: React.CSSProperties['alignItems'];
  justifyContent?: React.CSSProperties['justifyContent'];
  display?: React.CSSProperties['display'];
  flexWrap?: React.CSSProperties['flexWrap'];
  width?: React.CSSProperties['width'];
  fontWeight?: React.CSSProperties['fontWeight'];
  fontStyle?: React.CSSProperties['fontStyle'];
  mt?: ResponsiveStyleValue<number | string>;
  mb?: ResponsiveStyleValue<number | string>;
}

declare module '@mui/material/OverridableComponent' {
  interface CommonProps extends LegacyStyleProps {}
}

declare module '@mui/system/Box' {
  interface BoxOwnProps<Theme extends object = import('@mui/system').Theme>
    extends SystemProps<Theme> {}
}

declare module '@mui/material/Grid' {
  interface GridBaseProps extends SystemProps<Theme> {}
}

declare module '@mui/material/TextField' {
  interface BaseTextFieldProps {
    InputProps?: Partial<InputBaseProps>;
    inputProps?: InputBaseProps['inputProps'];
    InputLabelProps?: Partial<InputLabelProps>;
    SelectProps?: Partial<SelectProps>;
  }
}

declare module '@mui/material/ListItemText' {
  interface ListItemTextProps<
    PrimaryTypographyComponent extends React.ElementType = 'span',
    SecondaryTypographyComponent extends React.ElementType = 'p',
  > {
    primaryTypographyProps?: TypographyProps<PrimaryTypographyComponent> | Record<string, unknown>;
    secondaryTypographyProps?: TypographyProps<SecondaryTypographyComponent> | Record<string, unknown>;
  }
}

declare module '@mui/material/Dialog' {
  interface DialogProps {
    PaperProps?: Partial<PaperProps>;
  }
}

declare module '@mui/material/Autocomplete' {
  interface AutocompleteProps<
    Value,
    Multiple extends boolean | undefined,
    DisableClearable extends boolean | undefined,
    FreeSolo extends boolean | undefined,
    ChipComponent extends React.ElementType = import('@mui/material/Chip').ChipTypeMap['defaultComponent'],
  > {
    renderTags?: (
      value: Value[],
      getTagProps: (args: { index: number }) => Record<string, unknown>,
      ownerState: unknown,
    ) => React.ReactNode;
  }
}
