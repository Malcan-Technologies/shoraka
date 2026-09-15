import {
  frozenExecutionMergePerson,
  type FrozenDocumentExecutionContext,
} from "@cashsouk/types";
import type { FacilityAgreementMergeData } from "../applications/facility-agreement/fa-merge.types";
import type { JsgMergeData } from "../applications/joint-several-guarantee/jsg-merge.types";
import type { DeedOfAssignmentMergeData } from "../applications/deed-of-assignment/doa-merge.types";

function peopleForKind(
  execution: FrozenDocumentExecutionContext | null | undefined,
  documentKind: "FA" | "JSG" | "DOA"
) {
  return execution?.people.filter((person) => person.documentKind === documentKind) ?? [];
}

export function applyFrozenFaExecution(
  merge: FacilityAgreementMergeData,
  execution?: FrozenDocumentExecutionContext | null
): FacilityAgreementMergeData {
  const people = peopleForKind(execution, "FA");
  if (people.length === 0) return merge;
  const investor1 = frozenExecutionMergePerson(people, "FA_INVESTOR", 1);
  const investor2 = frozenExecutionMergePerson(people, "FA_INVESTOR", 2);
  const agent1 = frozenExecutionMergePerson(people, "FA_AGENT", 1);
  const agent2 = frozenExecutionMergePerson(people, "FA_AGENT", 2);
  const witness = frozenExecutionMergePerson(people, "FA_ISSUER_WITNESS", 1);
  return {
    ...merge,
    investor_1_name: investor1.name,
    investor_1_designation: investor1.designation,
    investor_2_name: investor2.name,
    investor_2_designation: investor2.designation,
    agent_1_name: agent1.name,
    agent_1_designation: agent1.designation,
    agent_2_name: agent2.name,
    agent_2_designation: agent2.designation,
    issuer_signatories: merge.issuer_signatories.map((signatory) => ({
      ...signatory,
      witness_name: witness.name,
      witness_nric: witness.identity_number,
    })),
  };
}

export function applyFrozenJsgExecution(
  merge: JsgMergeData,
  execution?: FrozenDocumentExecutionContext | null
): JsgMergeData {
  const people = peopleForKind(execution, "JSG");
  if (people.length === 0) return merge;
  const operator1 = frozenExecutionMergePerson(people, "JSG_OPERATOR", 1);
  const operator2 = frozenExecutionMergePerson(people, "JSG_OPERATOR", 2);
  const witness = frozenExecutionMergePerson(people, "JSG_GUARANTOR_WITNESS", 1);
  return {
    ...merge,
    operator_1_name: operator1.name,
    operator_1_nric: operator1.identity_number,
    operator_1_designation: operator1.designation,
    operator_2_name: operator2.name,
    operator_2_nric: operator2.identity_number,
    operator_2_designation: operator2.designation,
    guarantor_witness_name: witness.name,
    guarantor_witness_nric: witness.identity_number,
  };
}

export function applyFrozenDoaExecution(
  merge: DeedOfAssignmentMergeData,
  execution?: FrozenDocumentExecutionContext | null
): DeedOfAssignmentMergeData {
  const people = peopleForKind(execution, "DOA");
  if (people.length === 0) return merge;
  const ssp1 = frozenExecutionMergePerson(people, "DOA_SSP", 1);
  const ssp2 = frozenExecutionMergePerson(people, "DOA_SSP", 2);
  const witness = frozenExecutionMergePerson(people, "DOA_ASSIGNOR_WITNESS", 1);
  return {
    ...merge,
    ssp_1_name: ssp1.name,
    ssp_1_designation: ssp1.designation,
    ssp_2_name: ssp2.name,
    ssp_2_designation: ssp2.designation,
    assignor_signatories: merge.assignor_signatories.map((signatory) => ({
      ...signatory,
      witness_name: witness.name,
      witness_designation: witness.designation,
    })),
  };
}
