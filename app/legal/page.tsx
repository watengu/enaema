import Link from "next/link";

// エナエマ 法的ページ（利用規約・プライバシーポリシー）
// 原文は docs/legal/terms.md / privacy.md。改定したら本文と app/consent.tsx の
// バージョン（制定日）を一緒に上げること。

export const metadata = {
  title: "利用規約・プライバシーポリシー | エナエマ",
};

export default function LegalPage() {
  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          <Link href="/" className="underline">
            ← エナエマに戻る
          </Link>
        </p>
        <section id="terms" className="mt-8">
<h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display-jp)" }}>利用規約</h1>
<p className="mt-3 text-sm leading-[1.9]">制定日：2026年8月31日</p>
<p className="mt-3 text-sm leading-[1.9]">この利用規約（以下「本規約」といいます）は、エナエマ（以下「本アプリ」といいます）の利用条件を定めるものです。ユーザーは、本規約に同意の上、本アプリをご利用ください。</p>
<h2 className="mt-7 text-[15px] font-bold">第1条（適用）</h2>
<p className="mt-3 text-sm leading-[1.9]">本規約は、ユーザーと運営者との間の本アプリの利用に関わる一切の関係に適用されます。</p>
<h2 className="mt-7 text-[15px] font-bold">第2条（利用登録）</h2>
<ol className="mt-3 list-decimal space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>本アプリの一部機能は、ログインなしでも利用できます。</li>
<li>全機能を利用するには、運営者の定める方法によりアカウント登録が必要です。</li>
<li>運営者は、登録希望者に以下の事由があると判断した場合、登録を拒否することがあります。- 虚偽の情報を届け出た場合- 本規約に違反したことがある場合- その他運営者が利用登録を相当でないと判断した場合</li>
</ol>
<h2 className="mt-7 text-[15px] font-bold">第3条（禁止事項）</h2>
<p className="mt-3 text-sm leading-[1.9]">ユーザーは、本アプリの利用にあたり、以下の行為をしてはなりません。</p>
<ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>法令または公序良俗に違反する行為</li>
<li>犯罪行為に関連する行為</li>
<li>運営者、他のユーザー、その他第三者の権利・利益を侵害する行為</li>
<li>他のユーザーへの誹謗中傷、嫌がらせ、なりすまし行為</li>
<li>本アプリのソーシャル機能を利用したスパム投稿・宣伝行為</li>
<li>本アプリで使用されているキャラクター・画像・テキスト等の無断複製・二次配布・商用利用</li>
<li>本アプリの運営を妨害する行為</li>
<li>不正アクセス、またはこれを試みる行為</li>
<li>その他、運営者が不適切と判断する行為</li>
</ul>
<h2 className="mt-7 text-[15px] font-bold">第4条（投稿コンテンツについて）</h2>
<ol className="mt-3 list-decimal space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>ユーザーが本アプリ内（タイムライン、コメント等）に投稿した内容の著作権はユーザーに帰属しますが、ユーザーは運営者に対し、本アプリの運営・改善に必要な範囲での利用を許諾するものとします。</li>
<li>運営者は、投稿内容が本規約に違反すると判断した場合、事前の通知なく投稿の削除、公開範囲の変更等の措置を講じることができます。</li>
<li>ユーザーは、他のユーザーをブロックすることができ、ブロックしたユーザーの投稿は相互に非表示となります。</li>
</ol>
<h2 className="mt-7 text-[15px] font-bold">第5条（キャラクター・コンテンツの著作権）</h2>
<p className="mt-3 text-sm leading-[1.9]">本アプリ内で使用されるキャラクター画像、イラスト、テキスト等の著作権その他の権利は、運営者または正当な権利を有する者に帰属します。ユーザーは、運営者が許可した範囲でのみこれらを利用できます。</p>
<h2 className="mt-7 text-[15px] font-bold">第6条（本アプリの提供の停止等）</h2>
<p className="mt-3 text-sm leading-[1.9]">運営者は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本アプリの全部または一部の提供を停止または中断することができます。</p>
<ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>システムの保守点検または更新を行う場合</li>
<li>地震、落雷、火災、停電、天災等の不可抗力により提供が困難となった場合</li>
<li>その他、運営者が停止または中断を必要と判断した場合</li>
</ul>
<h2 className="mt-7 text-[15px] font-bold">第7条（利用制限および登録抹消）</h2>
<p className="mt-3 text-sm leading-[1.9]">運営者は、ユーザーが本規約のいずれかの条項に違反した場合、事前の通知なく、投稿の削除、当該ユーザーへの本アプリの全部もしくは一部の利用制限、またはアカウントの削除等の措置を講じることができます。</p>
<h2 className="mt-7 text-[15px] font-bold">第8条（退会）</h2>
<p className="mt-3 text-sm leading-[1.9]">ユーザーは、運営者の定める方法により、いつでも本アプリから退会し、アカウントを削除することができます。</p>
<h2 className="mt-7 text-[15px] font-bold">第9条（保証の否認・免責事項）</h2>
<ol className="mt-3 list-decimal space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>運営者は、本アプリに事実上または法律上の瑕疵がないことを明示的にも黙示的にも保証しません。</li>
<li>運営者は、本アプリに起因してユーザーに生じたあらゆる損害について、運営者の故意または重過失による場合を除き、一切の責任を負いません。</li>
<li>本アプリ内のタスク・美容情報等は一般的な情報提供を目的としており、医学的・専門的な助言を代替するものではありません。</li>
</ol>
<h2 className="mt-7 text-[15px] font-bold">第10条（有料機能について）</h2>
<ol className="mt-3 list-decimal space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>運営者は、将来的に本アプリの一部機能を有料で提供することがあります。</li>
<li>有料機能の価格、支払い方法等は、別途定める特定商取引法に基づく表記および購入画面の表示に従うものとします。</li>
</ol>
<h2 className="mt-7 text-[15px] font-bold">第11条（利用規約の変更）</h2>
<p className="mt-3 text-sm leading-[1.9]">運営者は、必要と判断した場合には、ユーザーへの事前の通知をもって、本規約を変更することができます。</p>
<h2 className="mt-7 text-[15px] font-bold">第12条（準拠法・裁判管轄）</h2>
<ol className="mt-3 list-decimal space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
<li>本アプリに関して紛争が生じた場合には、運営者の所在地を管轄する裁判所を専属的合意管轄とします。</li>
</ol>
<p className="mt-3 text-sm leading-[1.9]">以上</p>
        </section>
        <section id="privacy" className="mt-16">
<h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display-jp)" }}>プライバシーポリシー</h1>
<p className="mt-3 text-sm leading-[1.9]">制定日：2026年8月31日</p>
<p className="mt-3 text-sm leading-[1.9]">エナエマ（以下「本アプリ」といいます）の運営者（以下「運営者」といいます）は、本アプリの提供にあたり、ユーザーの個人情報を含む情報を以下のとおり取り扱います。</p>
<h2 className="mt-7 text-[15px] font-bold">1. 取得する情報</h2>
<p className="mt-3 text-sm leading-[1.9]">本アプリでは、サービス提供のために以下の情報を取得します。</p>
<ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>アカウント情報（メールアドレス等、ログインに必要な情報）</li>
<li>診断結果（パーソナルカラー、骨格タイプ、顔タイプ）</li>
<li>選択したキャラクター、テーマ等の設定情報</li>
<li>タスク・ルーチンの利用履歴（達成状況、実施日時等）</li>
<li>アプリ内投稿内容（タイムライン投稿、コメント等）</li>
<li>端末情報・利用状況に関する情報（アプリの動作改善のため）</li>
</ul>
<p className="mt-3 text-sm leading-[1.9]">なお、本アプリは氏名・住所・電話番号等の直接的な個人識別情報の入力を必須としません。表示名にはニックネームまたはキャラクター名のみを使用し、本名・メールアドレス等は他のユーザーに公開されません。</p>
<h2 className="mt-7 text-[15px] font-bold">2. 利用目的</h2>
<p className="mt-3 text-sm leading-[1.9]">取得した情報は、以下の目的で利用します。</p>
<ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>本アプリの提供・維持・改善のため</li>
<li>ユーザーに合わせたタスク・キャラクター表示等のパーソナライズのため</li>
<li>ソーシャル機能（タイムライン、コメント表示等）の提供のため</li>
<li>不正利用・迷惑行為の防止のため</li>
<li>お問い合わせへの対応のため</li>
<li>将来的な有料機能の提供・決済処理のため</li>
</ul>
<h2 className="mt-7 text-[15px] font-bold">3. 第三者提供</h2>
<p className="mt-3 text-sm leading-[1.9]">運営者は、以下の場合を除き、取得した情報を本人の同意なく第三者に提供しません。</p>
<ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>法令に基づく場合</li>
<li>人の生命・身体・財産の保護のために必要な場合</li>
<li>本アプリの運営に必要な業務委託先（後述のインフラ事業者等）に業務の範囲内で提供する場合</li>
</ul>
<h2 className="mt-7 text-[15px] font-bold">4. 外部サービスの利用</h2>
<p className="mt-3 text-sm leading-[1.9]">本アプリは、以下の外部サービスを利用してデータを保管・処理しています。</p>
<ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>Supabase（データベース・認証基盤）</li>
<li>Vercel（ホスティング）</li>
</ul>
<p className="mt-3 text-sm leading-[1.9]">これらの事業者は、それぞれのプライバシーポリシーおよびセキュリティ基準に基づき情報を管理しています。</p>
<h2 className="mt-7 text-[15px] font-bold">5. データの保管期間・削除</h2>
<ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm leading-[1.9]">
<li>アカウント削除（退会）の申請があった場合、運営者は合理的な期間内に当該ユーザーの個人情報を削除または匿名化します。</li>
<li>ソーシャル投稿（タイムライン等）は、仕様上一定時間（3時間）経過後に自動的に削除されます。</li>
</ul>
<h2 className="mt-7 text-[15px] font-bold">6. Cookie等の使用</h2>
<p className="mt-3 text-sm leading-[1.9]">本アプリは、ログイン状態の維持等のためにCookieまたは類似の技術を使用することがあります。</p>
<h2 className="mt-7 text-[15px] font-bold">7. ユーザーの権利</h2>
<p className="mt-3 text-sm leading-[1.9]">ユーザーは、自己の個人情報について、開示・訂正・削除等を求めることができます。お問い合わせ窓口までご連絡ください。</p>
<h2 className="mt-7 text-[15px] font-bold">8. 未成年者の利用について</h2>
<p className="mt-3 text-sm leading-[1.9]">未成年者が本アプリを利用する場合は、保護者の同意を得た上でご利用ください。</p>
<h2 className="mt-7 text-[15px] font-bold">9. プライバシーポリシーの変更</h2>
<p className="mt-3 text-sm leading-[1.9]">運営者は、必要に応じて本ポリシーを変更することがあります。重要な変更がある場合は、アプリ内での告知等、適切な方法で周知します。</p>
<h2 className="mt-7 text-[15px] font-bold">10. お問い合わせ窓口</h2>
<p className="mt-3 text-sm leading-[1.9]">本ポリシーに関するお問い合わせは、アプリ内のお問い合わせフォームよりご連絡ください。</p>
<p className="mt-3 text-sm leading-[1.9]">以上</p>
        </section>
        <p
          className="mt-16 border-t pt-4 text-xs"
          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
        >
          <Link href="/" className="underline">
            ← エナエマに戻る
          </Link>
        </p>
      </div>
    </main>
  );
}
