import { describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { PgDialect, pgTable, text } from 'drizzle-orm/pg-core';
import { mutualFriendCountSql } from '../src/routes/me';

// GET /api/me/friend-requests?direction=received の mutualFriendCount を作る
// mutualFriendCountSql() が生成する生SQLを直接検証する。
// me-friend-requests.spec.ts は DB 層をモックしているため、
// SQL文字列（テーブル名・カラム名・パラメータ化）自体はそちらでは検知できない。
//
// 他specファイルの mock.module('@repo/db', ...) は bun test 実行時にファイルをまたいで
// 残ることがあるため、'@repo/db' の user は使わず、このファイル専用のテーブルを用意する
// （他specとの実行順に依存させないため）。
const testUser = pgTable('mutual_friend_count_test_user', { id: text('id').primaryKey() });

describe('mutualFriendCountSql', () => {
  it('friendships テーブルと snake_case カラムを参照する', () => {
    const dialect = new PgDialect();
    const { sql: queryText } = dialect.sqlToQuery(mutualFriendCountSql(sql`${'user-a'}`, testUser.id));

    expect(queryText).toContain('friendships f1');
    expect(queryText).toContain('friendships f2');
    expect(queryText).toContain('f1.requester_id');
    expect(queryText).toContain('f1.addressee_id');
    expect(queryText).toContain('f2.requester_id');
    expect(queryText).toContain('f2.addressee_id');
    expect(queryText).toContain("f1.status = 'accepted'");
    expect(queryText).toContain("f2.status = 'accepted'");
  });

  it('Column 引数（userB）はエスケープされた識別子として展開される', () => {
    const dialect = new PgDialect();
    const { sql: queryText } = dialect.sqlToQuery(mutualFriendCountSql(sql`${'user-a'}`, testUser.id));

    expect(queryText).toContain('"mutual_friend_count_test_user"."id"');
  });

  it('文字列引数（userA）はSQL文に直接埋め込まれずパラメータ化される', () => {
    const dialect = new PgDialect();
    const secretLookingUserId = 'user-id-should-be-parameterized-not-inlined';
    const { sql: queryText, params } = dialect.sqlToQuery(mutualFriendCountSql(sql`${secretLookingUserId}`, testUser.id));

    expect(queryText).not.toContain(secretLookingUserId);
    expect(params).toContain(secretLookingUserId);
  });

  it('my_friends / their_friends を friend_id で JOIN する', () => {
    const dialect = new PgDialect();
    const { sql: queryText } = dialect.sqlToQuery(mutualFriendCountSql(sql`${'user-a'}`, testUser.id));

    expect(queryText).toContain('my_friends');
    expect(queryText).toContain('their_friends');
    expect(queryText).toContain('my_friends.friend_id = their_friends.friend_id');
    expect(queryText).toContain('COUNT(*)::int');
  });
});
