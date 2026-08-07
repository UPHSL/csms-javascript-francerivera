Standard Ticket Workflow
git status
git switch main
git pull origin main
git switch -c feature/<ticket-name>

Implement and verify the ticket.

Then:

npm test
git status
git diff
git add .
git status
git commit -m "type: short description"
git push -u origin feature/<ticket-name>

Create a Pull Request when required.

Commit Types
feat
fix
test
docs
refactor
chore

Examples:

feat: implement resident registration
fix: validate resident identifier
test: add resident service tests
docs: update JavaScript project documentation
refactor: simplify resident service
chore: establish application architecture


Update Main
git switch main
git pull origin main
Create a Ticket Branch
git switch -c feature/<ticket-name>

Example:

git switch -c feature/csms-101-navigation
Review Changes
git diff
Stage Changes
git add .
Commit
git commit -m "feat: short description"
Push a New Branch
git push -u origin <branch-name>
View Recent History
git log --oneline -5
Unstage a File
git restore --staged <file>
Restore an Unstaged File
git restore <file>

Use restore carefully.

Commit Types
feat
fix
test
docs
refactor
chore
JavaScript Verification Commands
npm test
npm start
npm run dev

Before every commit:

npm test
git status
git diff



Before Starting
git switch main
git pull origin main
git status
Before Committing
npm test
git status
git diff
Before Pushing
npm test
git status
Pull Request Requirements
correct ticket reference
implementation summary
completed acceptance criteria
test results
manual verification
no unrelated changes
meaningful commits
Main Branch

The main branch represents the stable integrated application.

Normal ticket development should occur in a separate branch.

Ticket Completion

A ticket is ready when:

The requirement works
+
Acceptance criteria are satisfied
+
Tests pass
+
Changes are traceable
+
The required workflow was followed