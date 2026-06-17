import readline from 'readline';

/**
 * Ask user a question and wait for input
 * Returns the user's input as string
 * Returns null if stdin is not a TTY (non-interactive mode)
 */
export const askUser = (question: string): Promise<string | null> => {
  return new Promise((resolve) => {
    // Check if running in interactive terminal
    if (!process.stdin.isTTY) {
      resolve(null);
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
};

/**
 * Ask a yes/no question
 * Returns true for 'y', 'yes', false for 'n', 'no'
 * Returns null if non-interactive
 */
export const askYesNo = async (question: string): Promise<boolean | null> => {
  const answer = await askUser(`${question} (y/n) `);
  if (answer === null) return null;
  return answer === 'y' || answer === 'yes';
};