# Feedback Schedule

A comprehensive feedback scheduling system designed for barbershop singing competitions with BHS (Barbershop Harmony Society) contest entry and style feedback types. Features drag-and-drop session management, conflict detection, and automated report generation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.1.2-646CFF.svg)](https://vitejs.dev/)

## Live Demo

**Primary Site**: [feedbackschedule.com](https://feedbackschedule.com)  
**GitHub Pages**: [mblac056.github.io/feedbackschedule](https://mblac056.github.io/feedbackschedule)

## Features

### Core Functionality
- **Drag & Drop Scheduling** - Intuitive visual scheduling interface
- **BHS Session Types** - Support for 1xLong, 3x20min, and 3x10min feedback sessions (BHS contest format)
- **Conflict Detection** - Automatic detection of scheduling conflicts
- **Judge Preferences** - Manage judge preferences and assignments
- **Real-time Updates** - Live updates as you modify the schedule

### Management Tools
- **BHS CSV Import/Export** - Import judges and entrants from BHS contest entry CSV files
- **Bulk Operations** - Clear grid, populate grid, and batch operations
- **Session Management** - Add, edit, and remove sessions easily
- **Settings Configuration** - Customizable session lengths and timing

### Report Generation
- **Feedback Matrix** - Complete overview of all sessions
- **Judge Schedules** - Individual judge schedules
- **Entrant Schedules** - Individual entrant schedules
- **Flow Documents** - Event flow documentation
- **Feedback Announcements** - Ready-to-print announcements
- **Preference Check** - Verify entrant preferences

### Responsive Design
- **Mobile-Friendly** - Works on all device sizes, (but optimized for desktop devices)
- **Keyboard Shortcuts** - Quick access to common functions

## Technology Stack

- **Frontend**: React 19.1.1 with TypeScript
- **Build Tool**: Vite 7.1.2
- **Styling**: Tailwind CSS 4.1.12
- **Icons**: React Icons 5.5.0
- **PDF Generation**: jsPDF with html2pdf.js
- **State Management**: React Context API
- **Local Storage**: Custom service for data persistence

## Quick Start

### Prerequisites
- Node.js 18 or higher
- npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mblac056/feedbackschedule.git
   cd feedbackschedule
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

   Or visit the live site at [feedbackschedule.com](https://feedbackschedule.com)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage Guide

### Getting Started

1. **Import Judges** - Click "Manage Judges" to add your judging panel
2. **Import Entrants** - Click "Manage Entrants" to add competition participants
3. **Configure Settings** - Set session lengths and timing preferences
4. **Schedule Sessions** - Drag and drop sessions onto the grid
5. **Generate Reports** - Use the print dropdown to create various reports

### Keyboard Shortcuts

- `E` - Open Import/Export modal
- `P` - Open / close preferences panel
- `Esc` - Close modals

### CSV Import Format

The application supports importing judges and entrants from BHS contest entry CSV files. The system is specifically designed to work with Barbershop Harmony Society competition data formats. See the import modals for specific format requirements.

## Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx      # Main navigation
│   ├── SessionsArea.tsx # Main scheduling interface
│   ├── PreferencesPanel.tsx # Judge preferences
│   └── ...
├── contexts/           # React contexts
├── hooks/             # Custom hooks
├── services/          # Business logic
├── utils/             # Utility functions
├── config/            # Configuration files
└── types.ts           # TypeScript type definitions
```

## Contributing

Help me build handy sh*t for the BHS! See the [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run lint`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Michael Black**
- Website: [michael-black.com](https://michael-black.com)
- GitHub: [@mblac056](https://github.com/mblac056)
- Project Site: [feedbackschedule.com](https://feedbackschedule.com)

## Acknowledgments

- Built with [React](https://reactjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Bundled with [Vite](https://vitejs.dev/)
- Icons by [React Icons](https://react-icons.github.io/react-icons/)

## Project Status

![GitHub last commit](https://img.shields.io/github/last-commit/mblac056/feedbackschedule)
![GitHub issues](https://img.shields.io/github/issues/mblac056/feedbackschedule)
![GitHub pull requests](https://img.shields.io/github/issues-pr/mblac056/feedbackschedule)

---

**Made with ❤️ for the barbershop singing community.**