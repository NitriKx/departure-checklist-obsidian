import { evaluateExpression } from './expressions';
import { Answers, Condition, Question } from './types';

export function evalCondition(
	condition: Condition,
	answers: Answers,
	scope: Record<string, number>,
): boolean {
	if (condition.greaterThan !== undefined || condition.lessThan !== undefined) {
		const value = evaluateExpression(condition.question, scope);
		if (value === null) {
			return false;
		}
		if (condition.greaterThan !== undefined && !(value > Number(condition.greaterThan))) {
			return false;
		}
		if (condition.lessThan !== undefined && !(value < Number(condition.lessThan))) {
			return false;
		}
		return true;
	}

	const answer = answers[condition.question];
	if (condition.equals !== undefined) {
		return answer === condition.equals;
	}
	if (condition.notEquals !== undefined) {
		return answer !== condition.notEquals;
	}
	if (condition.in !== undefined) {
		return answer !== undefined && condition.in.includes(answer);
	}
	return true;
}

export function isQuestionVisible(
	question: Question,
	answers: Answers,
	scope: Record<string, number>,
): boolean {
	return !question.showWhen || evalCondition(question.showWhen, answers, scope);
}
